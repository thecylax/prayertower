(() => {
  const cfg = window.TORRE_CONFIG;
  const celulas = window.CELULAS || [];
  const DIAS_SEMANA = [
    "domingo",
    "segunda-feira",
    "terça-feira",
    "quarta-feira",
    "quinta-feira",
    "sexta-feira",
    "sábado",
  ];

  const el = {
    titulo: document.getElementById("titulo"),
    subtitulo: document.getElementById("subtitulo"),
    dataExibida: document.getElementById("dataExibida"),
    agenda: document.getElementById("agenda"),
    status: document.getElementById("statusMsg"),
    modal: document.getElementById("modalReserva"),
    form: document.getElementById("formReserva"),
    modalSlotLabel: document.getElementById("modalSlotLabel"),
    modalError: document.getElementById("modalError"),
    inputNome: document.getElementById("inputNome"),
    selectCelula: document.getElementById("selectCelula"),
    btnCancelar: document.getElementById("btnCancelar"),
    btnSalvar: document.getElementById("btnSalvar"),
  };

  let supabase = null;
  let selectedSlot = null;
  let reservas = new Map();

  function hojeISO() {
    const d = new Date();
    return toISODate(d);
  }

  function toISODate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function parseISODate(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d);
  }

  function addDaysISO(iso, days) {
    const d = parseISODate(iso);
    d.setDate(d.getDate() + days);
    return toISODate(d);
  }

  function startDate() {
    return cfg.dataEvento || hojeISO();
  }

  function formatDateBR(iso) {
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
  }

  function formatWeekday(iso) {
    return DIAS_SEMANA[parseISODate(iso).getDay()];
  }

  function parseTimeToMinutes(hhmm) {
    const [h, m] = hhmm.split(":").map(Number);
    return h * 60 + m;
  }

  function minutesToHHMM(total) {
    const h = Math.floor(total / 60) % 24;
    const m = total % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }

  function slotKey(date, time) {
    return `${date}|${time}`;
  }

  /** Gera os horários ao longo de duracaoHoras a partir de data + horaInicio */
  function buildSlots() {
    const step = cfg.intervaloMinutos || 60;
    const totalMinutes = (cfg.duracaoHoras || 40) * 60;
    const startMinutes = parseTimeToMinutes(cfg.horaInicio || "00:00");
    const baseDate = startDate();
    const slots = [];

    for (let offset = 0; offset < totalMinutes; offset += step) {
      const absolute = startMinutes + offset;
      const dayOffset = Math.floor(absolute / (24 * 60));
      const minutesInDay = absolute % (24 * 60);
      const date = addDaysISO(baseDate, dayOffset);
      const time = minutesToHHMM(minutesInDay);
      slots.push({ date, time, key: slotKey(date, time) });
    }

    return slots;
  }

  function groupSlotsByDate(slots) {
    const groups = [];
    let current = null;

    slots.forEach((slot) => {
      if (!current || current.date !== slot.date) {
        current = { date: slot.date, slots: [] };
        groups.push(current);
      }
      current.slots.push(slot);
    });

    return groups;
  }

  function eventDates() {
    return [...new Set(buildSlots().map((s) => s.date))];
  }

  function periodLabel() {
    const dates = eventDates();
    if (dates.length === 0) return "";
    if (dates.length === 1) {
      return `${formatDateBR(dates[0])} · ${cfg.duracaoHoras || 40} horas`;
    }
    const first = dates[0];
    const last = dates[dates.length - 1];
    return `${formatDateBR(first)} a ${formatDateBR(last)} · ${cfg.duracaoHoras || 40} horas`;
  }

  function normalizeTime(value) {
    return String(value).slice(0, 5);
  }

  function setStatus(msg, isError = false) {
    el.status.textContent = msg || "";
    el.status.classList.toggle("status--error", Boolean(isError));
  }

  function isConfigured() {
    return (
      cfg.supabaseUrl &&
      !cfg.supabaseUrl.includes("SEU_PROJETO") &&
      cfg.supabaseAnonKey &&
      !cfg.supabaseAnonKey.includes("SUA_CHAVE")
    );
  }

  function fillCells() {
    celulas.forEach((nome) => {
      const opt = document.createElement("option");
      opt.value = nome;
      opt.textContent = nome;
      el.selectCelula.appendChild(opt);
    });
  }

  function createSlotButton(slot, index) {
    const reserva = reservas.get(slot.key);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `slot ${reserva ? "slot--taken" : "slot--free"}`;
    btn.style.animationDelay = `${Math.min(index * 12, 400)}ms`;
    btn.dataset.date = slot.date;
    btn.dataset.time = slot.time;

    const timeEl = document.createElement("span");
    timeEl.className = "slot__time";
    timeEl.textContent = slot.time;

    const meta = document.createElement("span");
    meta.className = "slot__meta";

    if (reserva) {
      btn.disabled = true;
      meta.textContent = `${reserva.name} · ${reserva.cell}`;
      btn.setAttribute(
        "aria-label",
        `${formatDateBR(slot.date)} ${slot.time}, preenchido por ${reserva.name}`
      );
    } else {
      meta.textContent = "Disponível — clique para reservar";
      btn.setAttribute(
        "aria-label",
        `${formatDateBR(slot.date)} ${slot.time}, horário vago`
      );
      btn.addEventListener("click", () => {
        if (!isConfigured()) {
          alert(
            "Configure o Supabase em js/config.js (e execute supabase-schema.sql) para salvar as reservas."
          );
          return;
        }
        openModal(slot);
      });
    }

    btn.append(timeEl, meta);
    return btn;
  }

  function renderAgenda() {
    const slots = buildSlots();
    const groups = groupSlotsByDate(slots);
    el.agenda.replaceChildren();

    let globalIndex = 0;

    groups.forEach((group, groupIndex) => {
      const section = document.createElement("section");
      section.className = "day";
      section.setAttribute("aria-labelledby", `day-title-${group.date}`);

      const header = document.createElement("header");
      header.className = "day__header";

      const title = document.createElement("h2");
      title.className = "day__title";
      title.id = `day-title-${group.date}`;
      title.textContent = `${formatWeekday(group.date)}, ${formatDateBR(group.date)}`;

      const range = document.createElement("p");
      range.className = "day__range";
      const first = group.slots[0].time;
      const last = group.slots[group.slots.length - 1].time;
      range.textContent = `${first} – ${last} · ${group.slots.length} horário(s)`;

      header.append(title, range);

      const grid = document.createElement("div");
      grid.className = "day__grid";

      group.slots.forEach((slot) => {
        grid.appendChild(createSlotButton(slot, globalIndex));
        globalIndex += 1;
      });

      if (groupIndex > 0) {
        section.classList.add("day--next");
      }

      section.append(header, grid);
      el.agenda.appendChild(section);
    });
  }

  function openModal(slot) {
    selectedSlot = slot;
    el.modalSlotLabel.textContent = `${formatWeekday(slot.date)}, ${formatDateBR(slot.date)} · ${slot.time}`;
    el.modalError.hidden = true;
    el.modalError.textContent = "";
    el.form.reset();
    el.selectCelula.selectedIndex = 0;
    el.modal.showModal();
    el.inputNome.focus();
  }

  function closeModal() {
    selectedSlot = null;
    el.modal.close();
  }

  async function loadReservas() {
    setStatus("Carregando agenda…");

    const dates = eventDates();
    const { data, error } = await supabase
      .from("prayer_slots")
      .select("event_date, slot_time, name, cell")
      .in("event_date", dates);

    if (error) {
      console.error(error);
      setStatus("Não foi possível carregar a agenda. Verifique a configuração.", true);
      return;
    }

    reservas = new Map();
    (data || []).forEach((row) => {
      const date = String(row.event_date).slice(0, 10);
      const time = normalizeTime(row.slot_time);
      reservas.set(slotKey(date, time), {
        name: row.name,
        cell: row.cell,
      });
    });

    const total = buildSlots().length;
    const livres = total - reservas.size;
    setStatus(`${reservas.size} horário(s) preenchido(s) · ${livres} vago(s)`);
    renderAgenda();
  }

  async function saveReserva(name, cell) {
    const { error } = await supabase.from("prayer_slots").insert({
      event_date: selectedSlot.date,
      slot_time: selectedSlot.time,
      name: name.trim(),
      cell: cell.trim(),
    });

    if (error) {
      if (error.code === "23505") {
        throw new Error("Este horário acabou de ser preenchido. Escolha outro.");
      }
      throw new Error(error.message || "Erro ao salvar. Tente novamente.");
    }
  }

  el.btnCancelar.addEventListener("click", closeModal);

  el.form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!selectedSlot) return;

    const name = el.inputNome.value.trim();
    const cell = el.selectCelula.value;

    if (!name || !cell) {
      el.modalError.textContent = "Preencha nome e célula.";
      el.modalError.hidden = false;
      return;
    }

    el.btnSalvar.disabled = true;
    el.modalError.hidden = true;

    try {
      await saveReserva(name, cell);
      closeModal();
      await loadReservas();
    } catch (err) {
      el.modalError.textContent = err.message;
      el.modalError.hidden = false;
      await loadReservas();
    } finally {
      el.btnSalvar.disabled = false;
    }
  });

  async function init() {
    el.titulo.textContent = cfg.titulo || "Torre de Oração";
    el.subtitulo.textContent = cfg.subtitulo || "";
    el.dataExibida.textContent = periodLabel();
    document.title = cfg.titulo || "Torre de Oração";

    fillCells();

    if (!isConfigured()) {
      setStatus(
        "Configure a URL e a chave do Supabase em js/config.js para ativar a agenda.",
        true
      );
      reservas = new Map();
      renderAgenda();
      return;
    }

    supabase = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
    await loadReservas();
    setInterval(loadReservas, 30000);
  }

  init();
})();
