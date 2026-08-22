// Package api is the localhost HTTP surface the Docker-tab panel calls (through
// a same-origin PHP proxy). It deliberately exposes only read + orchestrate
// verbs; it never proxies raw Docker create/exec/build.
package api

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/junkerderprovinz/cannonadecommand/internal/hostcpu"
	"github.com/junkerderprovinz/cannonadecommand/internal/hostnet"
	"github.com/junkerderprovinz/cannonadecommand/internal/iconsrc"
	"github.com/junkerderprovinz/cannonadecommand/internal/model"
	"github.com/junkerderprovinz/cannonadecommand/internal/netshape"
	"github.com/junkerderprovinz/cannonadecommand/internal/orchestrator"
	"github.com/junkerderprovinz/cannonadecommand/internal/unraidtmpl"
	"github.com/junkerderprovinz/cannonadecommand/internal/vmctl"
)

// Docker is the read + lifecycle surface the card panel needs. It stays small on
// purpose: list/inspect/stats + the safe lifecycle verbs, never create/exec/build.
type Docker interface {
	List(ctx context.Context) ([]model.Container, error)
	Start(ctx context.Context, name string) error
	Stop(ctx context.Context, name string) error
	Restart(ctx context.Context, name string) error
	Pause(ctx context.Context, name string) error
	Unpause(ctx context.Context, name string) error
	Stats(ctx context.Context, name string) (model.Stats, error)
	Limits(ctx context.Context, name string) (model.Limits, error)
	UpdateResources(ctx context.Context, name string, l model.Limits) error
	SetRestartPolicy(ctx context.Context, name, policy string) error
	HostMemTotal(ctx context.Context) int64
}

// hostMem returns the host's total RAM in bytes, preferring /proc/meminfo and falling
// back to what the Docker daemon reports (GET /info), so a box where the supervisor
// can't read /proc still yields a real value. Used for the state's host_mem AND the
// "remove RAM limit" sentinel — if this were 0, removal would be a no-op and the UI
// would read every container as still limited.
func (s *Server) hostMem(ctx context.Context) int64 {
	if m := hostcpu.MemTotal(); m > 0 {
		return m
	}
	return s.Docker.HostMemTotal(ctx)
}

// Store persists the plan + the automation config.
type Store interface {
	Load() (model.Plan, error)
	Save(model.Plan) error
	LoadConfig() (model.Config, error)
	SaveConfig(model.Config) error
}

// Runner orchestrates a plan.
type Runner interface {
	Run(ctx context.Context, plan model.Plan) model.RunResult
}

// IconSource is the icon pipeline's cache (optional; nil = the UI only ever sees
// the icon the container/plugin/VM itself ships). Kept as an interface so the API
// package stays free of the HTTP-fetching machinery and a test can stub it.
type IconSource interface {
	// Resolve answers from cache only and must never block on the network.
	Resolve(names []string) map[string]iconsrc.Result
	// SVG returns the cached artwork for a name, its kind, and whether it exists.
	SVG(name string) ([]byte, string, bool)
}

// VMController manages libvirt VM limits (optional; nil disables the VM-tab backend).
type VMController interface {
	List(ctx context.Context) ([]vmctl.VM, error)
	Apply(ctx context.Context, name string, lim vmctl.Limits) error
	Disks(ctx context.Context, name string) ([]vmctl.Disk, error)
	ResizeDisk(ctx context.Context, name, target string, newBytes int64) error
}

// Server wires the read/orchestrate handlers.
type Server struct {
	Docker       Docker
	Store        Store
	Runner       Runner
	VMs          VMController // optional: libvirt VM limits backend (CPU/RAM/bandwidth)
	Pidder       Pidder       // resolves a container's main PID for the bandwidth diagnostics
	BwLast       BwLaster     // optional: the monitor's last shaping attempt per container
	Kicker       Kicker       // optional: nudges the monitor to apply a saved config immediately
	Icons        IconSource   // optional: external icon lookup + cache for the icon pipeline (nil = native icons only)
	TemplatesDir string       // Unraid dockerMan templates dir; "" disables the apply-fest template write
	Version      string       // the running daemon's build version, surfaced in /api/state so the UI can show which backend is live

	mu      sync.Mutex
	lastRun model.RunResult

	opsMu    sync.Mutex
	limitOps []limitOp // last limit operations, for the Settings diagnostics card
}

// Handler returns the HTTP router.
func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/health", func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte("ok"))
	})
	mux.HandleFunc("GET /api/state", s.handleState)
	mux.HandleFunc("GET /api/plan", s.handleGetPlan)
	mux.HandleFunc("PUT /api/plan", s.handlePutPlan)
	mux.HandleFunc("POST /api/apply", s.handleApply)
	mux.HandleFunc("POST /api/action", s.handleAction)
	mux.HandleFunc("GET /api/stats", s.handleStats)
	// #13: proxy-safe host CPU % for the status island (the GraphQL websocket the native
	// Dashboard uses is often broken by reverse proxies; this HTTP poll always works).
	mux.HandleFunc("GET /api/hostcpu", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]int{"pct": hostcpu.Percent()})
	})
	// #12: proxy-safe host network throughput for the status island. Returns the primary
	// uplink's cumulative rx/tx byte counters; the browser deltas two polls into a rate.
	mux.HandleFunc("GET /api/hostnet", func(w http.ResponseWriter, _ *http.Request) {
		rx, tx := hostnet.Rate()
		writeJSON(w, http.StatusOK, map[string]uint64{"rx": rx, "tx": tx})
	})
	mux.HandleFunc("GET /api/limits", s.handleGetLimits)
	mux.HandleFunc("GET /api/limitlog", s.handleLimitLog)
	mux.HandleFunc("GET /api/bwstatus", s.handleBwStatus)
	mux.HandleFunc("POST /api/limits", s.handleSetLimits)
	mux.HandleFunc("POST /api/restartpolicy", s.handleSetRestartPolicy)
	mux.HandleFunc("GET /api/config", s.handleGetConfig)
	mux.HandleFunc("PUT /api/config", s.handlePutConfig)
	mux.HandleFunc("GET /api/vms", s.handleGetVMs)
	mux.HandleFunc("POST /api/vmlimits", s.handleSetVMLimits)
	mux.HandleFunc("GET /api/vmdisks", s.handleGetVMDisks)
	mux.HandleFunc("POST /api/vmdiskresize", s.handleResizeVMDisk)
	// Icon pipeline: a batch name→icon-source lookup and the cached SVG itself.
	mux.HandleFunc("POST /api/icons", s.handleIcons)
	mux.HandleFunc("GET /api/iconsvg", s.handleIconSVG)
	return mux
}

// handleIcons answers a batch "what have you got for these names?" from the icon
// cache. It NEVER performs a network fetch on the request path — unknown names
// come back as "pending" and are looked up by the resolver's background workers,
// so a slow or unreachable CDN can never delay (or hang) a Docker-tab render.
// No resolver configured (or an older engine) yields an empty map, which the
// frontend reads as "no external sources" and falls back to the native icon.
func (s *Server) handleIcons(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Names []string `json:"names"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	if s.Icons == nil {
		writeJSON(w, http.StatusOK, map[string]iconsrc.Result{})
		return
	}
	// Bound the batch: the Docker tab asks for every row at once, and a hostile
	// or buggy caller must not be able to make one request queue thousands.
	if len(req.Names) > 512 {
		req.Names = req.Names[:512]
	}
	writeJSON(w, http.StatusOK, s.Icons.Resolve(req.Names))
}

// handleIconSVG serves one cached icon as real image/svg+xml, so the browser can
// point an <img> straight at it (same-origin through the PHP proxy, which means
// the complexity heuristic's canvas read is not tainted). Only bytes already on
// the flash are served; a cache miss is a 404, never a live fetch.
func (s *Server) handleIconSVG(w http.ResponseWriter, r *http.Request) {
	if s.Icons == nil {
		http.NotFound(w, r)
		return
	}
	body, _, ok := s.Icons.SVG(r.URL.Query().Get("name"))
	if !ok {
		http.NotFound(w, r)
		return
	}
	w.Header().Set("Content-Type", "image/svg+xml")
	w.Header().Set("Cache-Control", "public, max-age=86400")
	_, _ = w.Write(body)
}

// handleGetVMs lists every libvirt domain with its current CPU/RAM/bandwidth limits.
// A box without libvirt (or a wedged libvirtd) yields an empty list, never a 500, so
// the VM tab simply shows no CC controls there.
func (s *Server) handleGetVMs(w http.ResponseWriter, r *http.Request) {
	if s.VMs == nil {
		writeJSON(w, http.StatusOK, []vmctl.VM{})
		return
	}
	vms, err := s.VMs.List(r.Context())
	if err != nil {
		log.Printf("vms: list: %v", err)
		writeJSON(w, http.StatusOK, []vmctl.VM{})
		return
	}
	s.overlayVMLimits(vms)
	writeJSON(w, http.StatusOK, vms)
}

// overlayVMLimits fills each VM's CPU cap + bandwidth from the stored config — these are the
// CC-owned limits the monitor re-asserts, so the config is their source of truth (the live cap
// can be transiently wiped by an Unraid VM-form apply; bandwidth never lives in libvirt).
func (s *Server) overlayVMLimits(vms []vmctl.VM) {
	cfg, err := s.Store.LoadConfig()
	if err != nil {
		return
	}
	by := make(map[string]model.VMLimit, len(cfg.VMLimits))
	for _, l := range cfg.VMLimits {
		by[l.Name] = l
	}
	for i := range vms {
		if l, ok := by[vms[i].Name]; ok {
			if l.CPUCap > 0 {
				vms[i].CPUCap = l.CPUCap
			}
			vms[i].InKbit = l.InKbit
			vms[i].OutKbit = l.OutKbit
		}
	}
}

// saveVMLimit stores (or clears) a VM's CPU cap + bandwidth in the config. A nil field is left
// unchanged; 0 clears it; an entry with everything clear is dropped.
func (s *Server) saveVMLimit(name string, cpuCap, inKbit, outKbit *int) error {
	cfg, err := s.Store.LoadConfig()
	if err != nil {
		return err
	}
	idx := -1
	for i := range cfg.VMLimits {
		if cfg.VMLimits[i].Name == name {
			idx = i
			break
		}
	}
	cur := model.VMLimit{Name: name}
	if idx >= 0 {
		cur = cfg.VMLimits[idx]
	}
	if cpuCap != nil {
		cur.CPUCap = *cpuCap
	}
	if inKbit != nil {
		cur.InKbit = *inKbit
	}
	if outKbit != nil {
		cur.OutKbit = *outKbit
	}
	empty := cur.CPUCap <= 0 && cur.InKbit <= 0 && cur.OutKbit <= 0
	switch {
	case empty && idx >= 0:
		cfg.VMLimits = append(cfg.VMLimits[:idx], cfg.VMLimits[idx+1:]...)
	case empty:
		// nothing to store
	case idx >= 0:
		cfg.VMLimits[idx] = cur
	default:
		cfg.VMLimits = append(cfg.VMLimits, cur)
	}
	return s.Store.SaveConfig(cfg)
}

// handleSetVMLimits applies CPU-pin / CPU-cap / RAM / bandwidth to ONE domain. The name
// must be one libvirt actually knows (never an arbitrary or flag-like string), and a
// cpuset is validated to a cpu-list before it reaches virsh.
func (s *Server) handleSetVMLimits(w http.ResponseWriter, r *http.Request) {
	if s.VMs == nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "vm backend disabled"})
		return
	}
	var req struct {
		Name     string  `json:"name"`
		CPUCores *string `json:"cpu_cores,omitempty"`
		CPUCap   *int    `json:"cpu_cap,omitempty"`
		MemMiB   *int    `json:"mem_mib,omitempty"`
		InKbit   *int    `json:"in_kbit,omitempty"`
		OutKbit  *int    `json:"out_kbit,omitempty"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "name required"})
		return
	}
	vms, err := s.VMs.List(r.Context())
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	known := false
	for _, v := range vms {
		if v.Name == req.Name {
			known = true
			break
		}
	}
	if !known {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "unknown vm: " + req.Name})
		return
	}
	if req.CPUCores != nil && *req.CPUCores != "" && !validCpuset(*req.CPUCores) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "bad cpuset (want a cpu list like 0-3,6): " + *req.CPUCores})
		return
	}
	// CPU/RAM go straight to libvirt (persisted in the domain XML, applied live if running).
	if req.CPUCores != nil || req.CPUCap != nil || req.MemMiB != nil {
		lim := vmctl.Limits{CPUCores: req.CPUCores, CPUCap: req.CPUCap, MemMiB: req.MemMiB}
		if err := s.VMs.Apply(r.Context(), req.Name, lim); err != nil {
			log.Printf("vmlimits: %s: %v", req.Name, err)
			writeErr(w, http.StatusInternalServerError, err)
			return
		}
	}
	// The CPU cap + bandwidth are ALSO stored in the config so the monitor re-asserts them every
	// tick — that is what makes the cap survive an Unraid VM-form "Apply" (which regenerates the
	// XML without it) and the bandwidth survive a VM restart onto a new tap. CPU pin + RAM stay
	// form-managed (applied once above), so CC never fights the Unraid form on those.
	if req.CPUCap != nil || req.InKbit != nil || req.OutKbit != nil {
		if err := s.saveVMLimit(req.Name, req.CPUCap, req.InKbit, req.OutKbit); err != nil {
			writeErr(w, http.StatusInternalServerError, err)
			return
		}
		if s.Kicker != nil {
			s.Kicker.Kick() // apply/re-assert now, not up to a monitor tick later
		}
	}
	log.Printf("vmlimits: %s applied", req.Name)
	fresh, _ := s.VMs.List(r.Context())
	s.overlayVMLimits(fresh)
	var out *vmctl.VM
	for i := range fresh {
		if fresh[i].Name == req.Name {
			out = &fresh[i]
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "vm": out})
}

// vmKnown reports whether name is a domain libvirt actually knows — the same guard the
// limit handlers use before any virsh call touches a caller-supplied name.
func (s *Server) vmKnown(ctx context.Context, name string) (bool, error) {
	vms, err := s.VMs.List(ctx)
	if err != nil {
		return false, err
	}
	for _, v := range vms {
		if v.Name == name {
			return true, nil
		}
	}
	return false, nil
}

// handleGetVMDisks lists one domain's resizable disks (target + source + current capacity), for
// the VM tab's disk-resize editor. Unknown/absent backend -> a clean error, never a 500.
func (s *Server) handleGetVMDisks(w http.ResponseWriter, r *http.Request) {
	if s.VMs == nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "vm backend disabled"})
		return
	}
	name := strings.TrimSpace(r.URL.Query().Get("name"))
	if name == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "name required"})
		return
	}
	ok, err := s.vmKnown(r.Context(), name)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	if !ok {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "unknown vm: " + name})
		return
	}
	disks, err := s.VMs.Disks(r.Context(), name)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	if disks == nil {
		disks = []vmctl.Disk{}
	}
	writeJSON(w, http.StatusOK, disks)
}

// handleResizeVMDisk grows one disk of a domain. The name is validated against the live domain
// list and the size is taken in GiB; vmctl enforces grow-only and picks the live (blockresize)
// vs shut-off (qemu-img) path. Returns the refreshed disk list so the UI can show the new size.
func (s *Server) handleResizeVMDisk(w http.ResponseWriter, r *http.Request) {
	if s.VMs == nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "vm backend disabled"})
		return
	}
	var req struct {
		Name    string  `json:"name"`
		Target  string  `json:"target"`
		SizeGiB float64 `json:"size_gib"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	req.Name = strings.TrimSpace(req.Name)
	req.Target = strings.TrimSpace(req.Target)
	if req.Name == "" || req.Target == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "name and target required"})
		return
	}
	if req.SizeGiB <= 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "size_gib must be > 0"})
		return
	}
	ok, err := s.vmKnown(r.Context(), req.Name)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	if !ok {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "unknown vm: " + req.Name})
		return
	}
	newBytes := int64(req.SizeGiB * 1024 * 1024 * 1024)
	if err := s.VMs.ResizeDisk(r.Context(), req.Name, req.Target, newBytes); err != nil {
		log.Printf("vmdiskresize: %s %s: %v", req.Name, req.Target, err)
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	log.Printf("vmdiskresize: %s %s -> %.1f GiB", req.Name, req.Target, req.SizeGiB)
	disks, _ := s.VMs.Disks(r.Context(), req.Name)
	if disks == nil {
		disks = []vmctl.Disk{}
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "disks": disks})
}

// known reports whether name is a live container (guards every write verb).
func (s *Server) known(ctx context.Context, name string) (bool, error) {
	containers, err := s.Docker.List(ctx)
	if err != nil {
		return false, err
	}
	for _, c := range containers {
		if c.Name == name {
			return true, nil
		}
	}
	return false, nil
}

type stateResp struct {
	Plan        model.Plan        `json:"plan"`
	Containers  []model.Container `json:"containers"`
	LastRun     model.RunResult   `json:"last_run"`
	DockerError string            `json:"docker_error,omitempty"`
	HostCPUs    int               `json:"host_cpus"`              // host logical-CPU count, for the pin grid
	HostCoreOf  []int             `json:"host_core_of,omitempty"` // physical-core id per logical CPU (HT grouping)
	HostPCores  []int             `json:"host_pcores,omitempty"`  // Intel hybrid P-core CPUs (empty on non-hybrid)
	HostECores  []int             `json:"host_ecores,omitempty"`  // Intel hybrid E-core CPUs (empty on non-hybrid)
	HostMem     int64             `json:"host_mem,omitempty"`     // host total RAM bytes, for "remove RAM limit"
	Version     string            `json:"version,omitempty"`      // the running daemon's build version, so the UI can show which backend is live
}

func (s *Server) handleState(w http.ResponseWriter, r *http.Request) {
	plan, err := s.Store.Load()
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	resp := stateResp{Plan: plan, HostCPUs: hostcpu.Count(), HostCoreOf: hostcpu.CoreOf(), HostMem: s.hostMem(r.Context()), Version: s.Version}
	resp.HostPCores, resp.HostECores = hostcpu.HybridPE()
	containers, derr := s.Docker.List(r.Context())
	if derr != nil {
		// Tolerate a docker hiccup: still return the plan + the last run, so the
		// panel degrades gracefully instead of going blank.
		resp.DockerError = derr.Error()
	} else {
		resp.Containers = containers
	}
	s.mu.Lock()
	resp.LastRun = s.lastRun
	s.mu.Unlock()
	writeJSON(w, http.StatusOK, resp)
}

func (s *Server) handleGetPlan(w http.ResponseWriter, _ *http.Request) {
	plan, err := s.Store.Load()
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	writeJSON(w, http.StatusOK, plan)
}

func (s *Server) handlePutPlan(w http.ResponseWriter, r *http.Request) {
	var plan model.Plan
	if err := json.NewDecoder(r.Body).Decode(&plan); err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	// Reject a structurally invalid plan (cycle / unknown dep) before persisting.
	if _, err := orchestrator.TopoStages(plan); err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	if err := s.Store.Save(plan); err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "saved"})
}

func (s *Server) handleApply(w http.ResponseWriter, r *http.Request) {
	plan, err := s.Store.Load()
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	res := s.Runner.Run(r.Context(), plan)
	s.mu.Lock()
	s.lastRun = res
	s.mu.Unlock()
	writeJSON(w, http.StatusOK, res)
}

// handleAction performs a single lifecycle verb on one container. The container
// name is validated against the live list before anything is sent to the socket.
func (s *Server) handleAction(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name   string `json:"name"`
		Action string `json:"action"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	containers, err := s.Docker.List(r.Context())
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	known := false
	for _, c := range containers {
		if c.Name == req.Name {
			known = true
			break
		}
	}
	if !known {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "unknown container: " + req.Name})
		return
	}

	var aerr error
	switch req.Action {
	case "start":
		aerr = s.Docker.Start(r.Context(), req.Name)
	case "stop":
		aerr = s.Docker.Stop(r.Context(), req.Name)
	case "restart":
		aerr = s.Docker.Restart(r.Context(), req.Name)
	case "pause":
		aerr = s.Docker.Pause(r.Context(), req.Name)
	case "unpause":
		aerr = s.Docker.Unpause(r.Context(), req.Name)
	default:
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "unknown action: " + req.Action})
		return
	}
	if aerr != nil {
		writeErr(w, http.StatusInternalServerError, aerr)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

// perCallTimeout bounds a single container's Docker call inside a fan-out (handleStats,
// handleGetLimits). A container that was JUST recreated (image pull/update in progress or
// just finished) can leave dockerd slow to answer for that ONE container specifically —
// without this, wg.Wait() blocks the WHOLE response (and every other container's already-
// ready result) on that single straggler, which starves the panel's poll loop for as long
// as dockerd takes to settle (observed live: one straggler held handleStats open 30+
// seconds right after a container update, freezing the whole Docker tab's polling).
const perCallTimeout = 8 * time.Second

// handleStats returns a one-shot resource snapshot for every running container,
// keyed by name. Snapshots are fetched concurrently but capped so a big host
// doesn't hammer the socket.
func (s *Server) handleStats(w http.ResponseWriter, r *http.Request) {
	containers, err := s.Docker.List(r.Context())
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	out := map[string]model.Stats{}
	var mu sync.Mutex
	var wg sync.WaitGroup
	sem := make(chan struct{}, 6)
	for _, c := range containers {
		if c.State != "running" {
			continue
		}
		wg.Add(1)
		sem <- struct{}{}
		go func(name string) {
			defer wg.Done()
			defer func() { <-sem }()
			cctx, cancel := context.WithTimeout(r.Context(), perCallTimeout)
			defer cancel()
			st, serr := s.Docker.Stats(cctx, name)
			if serr != nil {
				return
			}
			mu.Lock()
			out[name] = st
			mu.Unlock()
		}(c.Name)
	}
	wg.Wait()
	writeJSON(w, http.StatusOK, out)
}

// handleGetLimits returns CONFIGURED resource caps (0 = none). With ?name= it
// returns one container's caps; with no name it returns a map of EVERY container's
// caps (concurrent inspects, capped) so the panel can flag, in one round-trip,
// which containers actually have a CPU/RAM/pin limit set.
func (s *Server) handleGetLimits(w http.ResponseWriter, r *http.Request) {
	name := r.URL.Query().Get("name")
	if name == "" {
		containers, err := s.Docker.List(r.Context())
		if err != nil {
			writeErr(w, http.StatusInternalServerError, err)
			return
		}
		out := map[string]model.Limits{}
		var mu sync.Mutex
		var wg sync.WaitGroup
		sem := make(chan struct{}, 6)
		for _, c := range containers {
			wg.Add(1)
			sem <- struct{}{}
			go func(nm string) {
				defer wg.Done()
				defer func() { <-sem }()
				cctx, cancel := context.WithTimeout(r.Context(), perCallTimeout)
				defer cancel()
				lim, lerr := s.Docker.Limits(cctx, nm)
				if lerr != nil {
					return
				}
				mu.Lock()
				out[nm] = lim
				mu.Unlock()
			}(c.Name)
		}
		wg.Wait()
		writeJSON(w, http.StatusOK, out)
		return
	}
	ok, err := s.known(r.Context(), name)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	if !ok {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "unknown container: " + name})
		return
	}
	lim, err := s.Docker.Limits(r.Context(), name)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	writeJSON(w, http.StatusOK, lim)
}

// handleSetLimits sets a container's memory + CPU caps live (Docker update). The
// name is validated against the live list first; a zero field is left unchanged
// (Docker's update ignores 0 and cannot remove a cap — that needs recreating).
//
// Removal is explicit (remove_mem / remove_cpu), NOT "send 0": Docker cannot
// live-UNSET a cap, so "remove" means set it to practically unlimited — all host
// RAM / all host CPUs — and STRIP the flag from the template so a later recreate
// ("Apply") starts with no cap at all. The unlimited value is computed HERE, from
// the host totals the engine always knows (/proc/*), because the browser's cached
// hostMem can be 0 if its state fetch lost a race — which used to make the Remove
// button a silent no-op.
func (s *Server) handleSetLimits(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name       string `json:"name"`
		MemBytes   int64  `json:"mem_bytes"`
		NanoCPUs   int64  `json:"nano_cpus"`
		CpusetCPUs string `json:"cpuset_cpus"`
		RemoveMem  bool   `json:"remove_mem"`
		RemoveCPU  bool   `json:"remove_cpu"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	// Translate removal into a practical-unlimited live value, server-side. Guard on
	// >0 so a (near-impossible) /proc parse failure never sends a bogus 0/negative
	// cap; the template strip below still runs, so a recreate drops the cap either way.
	if req.RemoveMem {
		if mt := s.hostMem(r.Context()); mt > 0 {
			req.MemBytes = mt
		}
	}
	if req.RemoveCPU {
		if n := hostcpu.Count(); n > 0 {
			req.NanoCPUs = int64(n) * 1e9
			req.CpusetCPUs = "0-" + strconv.Itoa(n-1)
		}
	}
	// cpuset is passed straight to Docker; allow only a cpu-list (digits, commas,
	// hyphens) so nothing else can reach the daemon.
	if req.CpusetCPUs != "" && !validCpuset(req.CpusetCPUs) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "bad cpuset (want a cpu list like 0-3,6): " + req.CpusetCPUs})
		return
	}
	ok, err := s.known(r.Context(), req.Name)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	if !ok {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "unknown container: " + req.Name})
		return
	}
	// Mirror the limit into the Unraid container template so it survives an "Apply" (which
	// recreates from the template). Done BEFORE the live update and REGARDLESS of its
	// result: a REMOVAL then strips the cap from the template even if the live update fails
	// on this box, so a later Apply/recreate still lifts it. Best-effort; an empty value
	// REMOVES the flag. No --memory-swap is written (it needs the memsw cgroup, absent on
	// hosts without swap accounting — matching the live path, which omits MemorySwap).
	tmplResult := "template: no change"
	if s.TemplatesDir != "" {
		// CC's window value must ALWAYS win over the template's Extra Parameters: any
		// touch of RAM/CPU strips ALL conflicting docker flags of that family (an empty
		// value = remove-only), then re-adds only what CC set — so an Unraid recreate
		// cannot resurrect a stale template-written cap. A CLEAR only strips (rule: the
		// user's template is never re-populated on remove).
		flags := map[string]string{}
		if req.RemoveMem || req.MemBytes > 0 {
			flags["--memory"] = ""
			flags["-m"] = ""                   // short form of --memory
			flags["--memory-swap"] = ""        // never set a swap cap (memsw cgroup)
			flags["--memory-reservation"] = "" // soft cap would fight CC's hard cap
			if !req.RemoveMem {
				flags["--memory"] = strconv.FormatInt(req.MemBytes, 10)
			}
		}
		if req.RemoveCPU || req.NanoCPUs > 0 || req.CpusetCPUs != "" {
			flags["--cpus"] = ""
			flags["--cpuset-cpus"] = ""
			flags["--cpu-shares"] = "" // relative weight would fight CC's absolute cap
			if !req.RemoveCPU {
				if req.NanoCPUs > 0 {
					// 'f' (not 'g') so a small value never becomes scientific notation
					// (e.g. "1e-06"), which docker run --cpus would reject on an Apply.
					flags["--cpus"] = strconv.FormatFloat(float64(req.NanoCPUs)/1e9, 'f', -1, 64)
				}
				if req.CpusetCPUs != "" {
					flags["--cpuset-cpus"] = req.CpusetCPUs
				}
			}
		}
		// Bandwidth limits are tc-only (monitor/netshape); CC never wrote a rate flag
		// into ExtraParams, so there is no legacy rate token to strip here.
		if len(flags) > 0 {
			// NOT silent anymore: a failing template mirror means every Unraid recreate
			// (edit/apply/update) WIPES the live limits — the exact "green message but
			// nothing sticks" triple symptom. The result lands in the diagnostics log.
			if merr := unraidtmpl.SetExtraParams(s.TemplatesDir, req.Name, flags); merr != nil {
				tmplResult = "template FAILED: " + merr.Error()
			} else {
				tmplResult = "template ok"
			}
		}
	}
	// Every limit operation is RECORDED (ring buffer + supervisor log) and, on success,
	// VERIFIED by re-reading the container's live caps — so "did it actually apply?" is
	// answerable from the Settings diagnostics card instead of a fleeting popup.
	reqTxt := "mem=" + strconv.FormatInt(req.MemBytes, 10) + " nano=" + strconv.FormatInt(req.NanoCPUs, 10) + " cpuset=" + req.CpusetCPUs
	if req.RemoveMem {
		reqTxt += " remove_mem"
	}
	if req.RemoveCPU {
		reqTxt += " remove_cpu"
	}
	if err := s.Docker.UpdateResources(r.Context(), req.Name, model.Limits{MemBytes: req.MemBytes, NanoCPUs: req.NanoCPUs, CpusetCPUs: req.CpusetCPUs}); err != nil {
		s.recordOp(req.Name, reqTxt, err.Error(), tmplResult)
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	after := map[string]any{"status": "ok", "template": tmplResult}
	afterTxt := ""
	if l, e := s.Docker.Limits(r.Context(), req.Name); e == nil {
		after["after_mem"] = l.MemBytes
		after["after_nano"] = l.NanoCPUs
		after["after_cpuset"] = l.CpusetCPUs
		afterTxt = "mem=" + strconv.FormatInt(l.MemBytes, 10) + " nano=" + strconv.FormatInt(l.NanoCPUs, 10) + " cpuset=" + l.CpusetCPUs
	} else {
		// a FAILED verify read must be visible too — a bare "Angewendet" without values
		// hid exactly this case from the user.
		after["after_error"] = e.Error()
		afterTxt = "verify FAILED: " + e.Error()
	}
	s.recordOp(req.Name, reqTxt, "ok", afterTxt+" · "+tmplResult)
	writeJSON(w, http.StatusOK, after)
}

// handleSetRestartPolicy sets a container's Docker restart policy live (container
// update, no recreate) and mirrors it into the Unraid container template so it
// survives an "Apply"/recreate — the whole point for a container stuck on
// restart=no permanently. The policy must be one of Docker's four exact values,
// and the name is validated against the live list before anything reaches the
// socket. It mirrors handleSetLimits: template first (best-effort, regardless of
// the live result), then the live update, then a verify re-read + recordOp.
func (s *Server) handleSetRestartPolicy(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name   string `json:"name"`
		Policy string `json:"policy"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	req.Name = strings.TrimSpace(req.Name)
	req.Policy = strings.TrimSpace(req.Policy)
	if !validRestartPolicy(req.Policy) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "bad restart policy (want no|unless-stopped|always|on-failure): " + req.Policy})
		return
	}
	ok, err := s.known(r.Context(), req.Name)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	if !ok {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "unknown container: " + req.Name})
		return
	}
	// Mirror --restart into the Unraid template BEFORE the live update and REGARDLESS of
	// its result, exactly like handleSetLimits: a later Apply/recreate then keeps the new
	// policy instead of resurrecting the old one. Best-effort; the diagnostics log records
	// the outcome. SetExtraParams upserts --restart cleanly (strips any prior --restart
	// token, re-adds ours) and leaves every other flag — including CC's own CPU/RAM caps —
	// untouched, so the two mirrors never fight.
	tmplResult := "template: no change"
	if s.TemplatesDir != "" {
		if merr := unraidtmpl.SetExtraParams(s.TemplatesDir, req.Name, map[string]string{"--restart": req.Policy}); merr != nil {
			tmplResult = "template FAILED: " + merr.Error()
		} else {
			tmplResult = "template ok"
		}
	}
	reqTxt := "restart=" + req.Policy
	if err := s.Docker.SetRestartPolicy(r.Context(), req.Name, req.Policy); err != nil {
		s.recordOp(req.Name, reqTxt, err.Error(), tmplResult)
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	// Verify by re-reading the live policy, so "did it actually apply?" is answerable
	// from the Settings diagnostics card, and the UI can echo the confirmed value.
	after := map[string]any{"status": "ok", "template": tmplResult}
	afterTxt := ""
	if l, e := s.Docker.Limits(r.Context(), req.Name); e == nil {
		after["after_policy"] = l.RestartPolicy
		afterTxt = "restart=" + l.RestartPolicy
	} else {
		after["after_error"] = e.Error()
		afterTxt = "verify FAILED: " + e.Error()
	}
	s.recordOp(req.Name, reqTxt, "ok", afterTxt+" · "+tmplResult)
	writeJSON(w, http.StatusOK, after)
}

// validRestartPolicy accepts only Docker's four exact restart-policy names. The
// value is passed verbatim to the container-update endpoint and written into the
// template's --restart flag, so keep it strict.
func validRestartPolicy(p string) bool {
	switch p {
	case "no", "unless-stopped", "always", "on-failure":
		return true
	}
	return false
}

// limitOp is one recorded limit change (for the Settings diagnostics card).
type limitOp struct {
	Time   string `json:"time"`
	Name   string `json:"name"`
	Req    string `json:"req"`
	Result string `json:"result"`
	After  string `json:"after,omitempty"`
}

func (s *Server) recordOp(name, req, result, after string) {
	log.Printf("limits: %s: %s -> %s %s", name, req, result, after)
	s.opsMu.Lock()
	defer s.opsMu.Unlock()
	s.limitOps = append(s.limitOps, limitOp{Time: time.Now().Format("15:04:05"), Name: name, Req: req, Result: result, After: after})
	if len(s.limitOps) > 20 {
		s.limitOps = s.limitOps[len(s.limitOps)-20:]
	}
}

// handleLimitLog returns the last recorded limit operations, newest first.
func (s *Server) handleLimitLog(w http.ResponseWriter, _ *http.Request) {
	s.opsMu.Lock()
	out := make([]limitOp, len(s.limitOps))
	copy(out, s.limitOps)
	s.opsMu.Unlock()
	for i, j := 0, len(out)-1; i < j; i, j = i+1, j-1 {
		out[i], out[j] = out[j], out[i]
	}
	writeJSON(w, http.StatusOK, out)
}

// Pidder resolves a container's main process PID (the docker client implements it).
type Pidder interface {
	PID(ctx context.Context, ref string) (int, error)
}

// BwLaster reports the monitor's most recent shaping attempt for a container.
type BwLaster interface {
	LastBwApply(name string) string
}

// Kicker triggers an immediate monitor tick (the monitor implements it).
type Kicker interface {
	Kick()
}

// handleBwStatus answers "does the bandwidth limit ACTUALLY exist right now?" — it
// reads the live tc qdisc + CC_DL netfilter chain inside the container's netns, so
// the UI can show proof (or the exact failure) instead of a silent no-op.
func (s *Server) handleBwStatus(w http.ResponseWriter, r *http.Request) {
	name := r.URL.Query().Get("name")
	if ok, err := s.known(r.Context(), name); err != nil || !ok {
		writeErr(w, http.StatusBadRequest, fmt.Errorf("unknown container %q", name))
		return
	}
	if s.Pidder == nil {
		writeErr(w, http.StatusInternalServerError, fmt.Errorf("no pid resolver"))
		return
	}
	pid, err := s.Pidder.PID(r.Context(), name)
	if err != nil || pid <= 0 {
		writeJSON(w, http.StatusOK, map[string]any{"error": "container not running (no pid)"})
		return
	}
	iface := ""
	if cfg, cerr := s.Store.LoadConfig(); cerr == nil {
		iface = strings.TrimSpace(cfg.ShapeIface)
	}
	if iface == "" {
		iface = netshape.DetectIface(pid)
	}
	qdisc, filter := netshape.Show(iface, pid)
	last := ""
	if s.BwLast != nil {
		last = s.BwLast.LastBwApply(name)
	}
	writeJSON(w, http.StatusOK, map[string]any{"iface": iface, "pid": pid, "qdisc": qdisc, "filter": filter, "last_apply": last})
}

// handleGetConfig returns the automation config (schedules / watchdogs / notify).
func (s *Server) handleGetConfig(w http.ResponseWriter, _ *http.Request) {
	cfg, err := s.Store.LoadConfig()
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	writeJSON(w, http.StatusOK, cfg)
}

// handlePutConfig validates + persists the automation config. Only the safe
// lifecycle verbs are accepted for schedules; the monitor still never touches the
// Docker socket for anything but start/stop/restart.
func (s *Server) handlePutConfig(w http.ResponseWriter, r *http.Request) {
	var cfg model.Config
	if err := json.NewDecoder(r.Body).Decode(&cfg); err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	// #74 (live-caught, real box): CC's own cc.* localStorage surface easily exceeds 64 distinct
	// keys once per-area prefix variants are counted (cc./ccp./ccv./cch./ccs./ccf./ccd. — the same
	// base setting name repeated per area), and this cap being hit made every settings push fail
	// SILENTLY (the browser-side sync callers swallow PUT errors) with no visible symptom beyond
	// "settings don't stay synced across browsers" — confirmed live at exactly 64 stored keys. Each
	// entry is still capped at 64+4096 bytes below, so even 512 entries is a ~2MB worst case for one
	// atomically-written JSON file, negligible for an infrequent (800ms-debounced) write.
	if len(cfg.UISettings) > 512 {
		writeErr(w, http.StatusBadRequest, fmt.Errorf("too many ui settings"))
		return
	}
	for k, v := range cfg.UISettings {
		if len(k) > 64 || len(v) > 4096 {
			writeErr(w, http.StatusBadRequest, fmt.Errorf("ui setting too large: %s", k))
			return
		}
	}
	for _, sc := range cfg.Schedules {
		if sc.Action != "start" && sc.Action != "stop" && sc.Action != "restart" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "bad schedule action: " + sc.Action})
			return
		}
		// The monitor matches the time by exact "HH:MM" string equality against the
		// host clock's zero-padded now.Format("15:04"), so reject anything that could
		// never match (a non-zero-padded or malformed time = a silently dead schedule).
		if !validScheduleTime(sc.Time) {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "bad schedule time (want HH:MM, zero-padded): " + sc.Time})
			return
		}
		for _, d := range sc.Days {
			if d < 0 || d > 6 {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": "bad schedule day (want 0-6)"})
				return
			}
		}
	}
	for _, b := range cfg.Bandwidths {
		if b.Name == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "bandwidth entry with no container name"})
			return
		}
		if b.EgressKbit < 0 || b.EgressKbit > 10_000_000 || b.IngressKbit < 0 || b.IngressKbit > 10_000_000 {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "bad bandwidth rate (want 0-10000000 kbit)"})
			return
		}
	}
	if cfg.ShapeIface != "" && !validIface(cfg.ShapeIface) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "bad shaping interface (want a name like eth0, br0.20)"})
		return
	}
	for _, is := range cfg.IdleStops {
		if is.Name == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "idle-stop entry with no container name"})
			return
		}
		if is.IdleMinutes < 0 || is.IdleMinutes > 44640 { // 0..31 days (0 = inert; the monitor ignores it)
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "bad idle-stop minutes (want 0-44640)"})
			return
		}
		if is.CPUThresholdPct < 0 || is.CPUThresholdPct > 100 {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "bad idle-stop CPU threshold (want 0-100)"})
			return
		}
	}
	if err := s.Store.SaveConfig(cfg); err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	if s.Kicker != nil {
		s.Kicker.Kick() // apply new bandwidth limits immediately, not up to 30s later
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "saved"})
}

// validScheduleTime requires a strictly zero-padded 24h "HH:MM" (00:00–23:59),
// matching the monitor's now.Format("15:04"); time.Parse is too lenient here (it
// would accept "9:00", which can never string-equal the padded clock).
func validScheduleTime(s string) bool {
	if len(s) != 5 || s[2] != ':' {
		return false
	}
	for i := 0; i < 5; i++ {
		if i == 2 {
			continue
		}
		if s[i] < '0' || s[i] > '9' {
			return false
		}
	}
	h := int(s[0]-'0')*10 + int(s[1]-'0')
	m := int(s[3]-'0')*10 + int(s[4]-'0')
	return h <= 23 && m <= 59
}

// validIface accepts a Linux interface name like "eth0", "br0.20", "bond0" — letters,
// digits and . _ : - only, within the kernel's 15-char limit. It reaches tc via argv
// (exec, no shell), so this is tidiness + a sanity guard, not the sole injection barrier.
func validIface(s string) bool {
	if len(s) == 0 || len(s) > 15 {
		return false
	}
	for i := 0; i < len(s); i++ {
		c := s[i]
		switch {
		case c >= 'a' && c <= 'z', c >= 'A' && c <= 'Z', c >= '0' && c <= '9',
			c == '.', c == '_', c == '-', c == ':':
			continue
		default:
			return false
		}
	}
	return true
}

// validCpuset accepts a Linux cpu-list like "0-3,6" (digits, commas, hyphens only,
// bounded length). It is passed verbatim to Docker's CpusetCpus, so keep it strict.
func validCpuset(s string) bool {
	if len(s) == 0 || len(s) > 128 {
		return false
	}
	for i := 0; i < len(s); i++ {
		c := s[i]
		digit := c >= '0' && c <= '9'
		if !digit && c != ',' && c != '-' {
			return false
		}
	}
	return true
}

func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(v)
}

func writeErr(w http.ResponseWriter, code int, err error) {
	writeJSON(w, code, map[string]string{"error": err.Error()})
}
