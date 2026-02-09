document.addEventListener("DOMContentLoaded", () => {
  console.log("APP.JS ZAŁADOWANY");

  // testowy przycisk (działa tylko jeśli istnieje)
  const btn = document.getElementById("btn");
  if (btn) {
    btn.addEventListener("click", () => {
      alert("Klik działa!");
    });
  }

  // menu
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("overlay");
  const openBtn = document.getElementById("openMenu");
  const closeBtn = document.getElementById("closeMenu");

  // jeśli jesteśmy na stronie bez menu (login/register) – OK, nic nie rób
  if (!sidebar || !overlay || !openBtn || !closeBtn) return;

  const openMenu = () => {
    sidebar.classList.add("open");
    overlay.classList.add("show");
  };

  const closeMenu = () => {
    sidebar.classList.remove("open");
    overlay.classList.remove("show");
  };

  openBtn.addEventListener("click", openMenu);
  closeBtn.addEventListener("click", closeMenu);
  overlay.addEventListener("click", closeMenu);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeMenu();
  });
});

document.addEventListener("DOMContentLoaded", () => {
  const grids = document.querySelectorAll(".time-grid");
  if (!grids.length) return;

  let isDragging = false;
  let startIndex = null;
  let currentGrid = null;

  function clearGridSelection(grid) {
    grid.querySelectorAll(".slot.selected").forEach(s => s.classList.remove("selected"));
  }

  function paintRange(grid, a, b) {
    const min = Math.min(a, b);
    const max = Math.max(a, b);
    clearGridSelection(grid);
    grid.querySelectorAll(".slot").forEach(slot => {
      const idx = parseInt(slot.dataset.index, 10);
      if (idx >= min && idx <= max) slot.classList.add("selected");
    });
  }

  function indexToTime(idx) {
    // 30 min per slot
    const minutes = idx * 30;
    const hh = String(Math.floor(minutes / 60)).padStart(2, "0");
    const mm = String(minutes % 60).padStart(2, "0");
    return `${hh}:${mm}`;
  }

  async function saveShift(employeeId, dateStr, startIdx, endIdx) {
    // endIdx ma być "po" ostatnim — więc dodajemy +1 slot
    const start = indexToTime(Math.min(startIdx, endIdx));
    const end = indexToTime(Math.max(startIdx, endIdx) + 1);

    const csrftoken = document.cookie
      .split("; ")
      .find(row => row.startsWith("csrftoken="))
      ?.split("=")[1];

    const res = await fetch("/api/shifts/create/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": csrftoken,
      },
      body: JSON.stringify({
        employee_id: employeeId,
        date: dateStr,
        start: start,
        end: end,
      })
    });

    const data = await res.json();
    if (!data.ok) alert(data.error || "Błąd zapisu grafiku");
  }

  grids.forEach(grid => {
    grid.addEventListener("mousedown", (e) => {
      const slot = e.target.closest(".slot");
      if (!slot) return;

      isDragging = true;
      currentGrid = grid;
      startIndex = parseInt(slot.dataset.index, 10);

      paintRange(grid, startIndex, startIndex);
    });

    grid.addEventListener("mousemove", (e) => {
      if (!isDragging || currentGrid !== grid) return;
      const slot = e.target.closest(".slot");
      if (!slot) return;

      const idx = parseInt(slot.dataset.index, 10);
      paintRange(grid, startIndex, idx);
    });

    grid.addEventListener("mouseup", async (e) => {
      if (!isDragging || currentGrid !== grid) return;
      isDragging = false;

      const slot = e.target.closest(".slot");
      if (!slot) return;

      const endIndex = parseInt(slot.dataset.index, 10);

      const employeeId = grid.dataset.employee;
      const dateStr = grid.dataset.date;

      await saveShift(employeeId, dateStr, startIndex, endIndex);

      currentGrid = null;
      startIndex = null;
    });

    grid.addEventListener("mouseleave", () => {
      // jeśli wyjedziesz myszą poza grid w trakcie drag — nie resetujemy
      // (użytkownik wróci i dokończy). To daje przyjemniejsze UX.
    });
  });

  document.addEventListener("mouseup", () => {
    // “bezpiecznik” gdy puścisz poza gridem
    isDragging = false;
    currentGrid = null;
    startIndex = null;
  });
});

document.addEventListener("DOMContentLoaded", () => {
  const cal = document.getElementById("calendar");
  if (!cal) return;

  const employeeId = cal.dataset.employeeId;
  const saveUrl = cal.dataset.saveUrl;

  let isDown = false;
  let startSlot = null;
  let currentDate = null;
  let mode = "add"; // add albo remove

  const clearTemp = () => {
    document.querySelectorAll(".slot.selected").forEach(el => el.classList.remove("selected"));
  };

  const highlightRange = (fromHour, toHour, dateStr) => {
    clearTemp();
    const minH = Math.min(fromHour, toHour);
    const maxH = Math.max(fromHour, toHour);
    for (let h = minH; h <= maxH; h++) {
      const el = document.querySelector(`.slot[data-date="${dateStr}"][data-hour="${h}"]`);
      if (el) el.classList.add("selected");
    }
  };

  const getCSRF = () => {
    const m = document.cookie.match(/csrftoken=([^;]+)/);
    return m ? m[1] : "";
  };

  async function applySelection() {
    const selected = Array.from(document.querySelectorAll(`.slot.selected[data-date="${currentDate}"]`));
    if (!selected.length) return;

    const hours = selected.map(el => parseInt(el.dataset.hour, 10)).sort((a,b)=>a-b);
    const startHour = hours[0];
    const endHour = hours[hours.length - 1] + 1;

    const res = await fetch(saveUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": getCSRF(),
      },
      body: JSON.stringify({
        employee_id: employeeId,
        date: currentDate,
        start_hour: startHour,
        end_hour: endHour,
        action: mode, // "add" albo "remove"
      })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      alert(data.error || "Błąd zapisu");
      return;
    }

    // aktualizacja UI
    selected.forEach(el => {
      el.classList.remove("selected");
      if (mode === "add") el.classList.add("busy");
      if (mode === "remove") el.classList.remove("busy");
    });
  }

  cal.addEventListener("mousedown", (e) => {
    const slot = e.target.closest(".slot");
    if (!slot) return;

    isDown = true;
    startSlot = slot;
    currentDate = slot.dataset.date;

    // jeśli zaczynamy na zielonym -> usuwamy, inaczej dodajemy
    mode = slot.classList.contains("busy") ? "remove" : "add";

    const h = parseInt(slot.dataset.hour, 10);
    highlightRange(h, h, currentDate);
    e.preventDefault();
  });

  cal.addEventListener("mouseover", (e) => {
    if (!isDown) return;
    const slot = e.target.closest(".slot");
    if (!slot) return;

    if (slot.dataset.date !== currentDate) return;

    const startHour = parseInt(startSlot.dataset.hour, 10);
    const endHour = parseInt(slot.dataset.hour, 10);
    highlightRange(startHour, endHour, currentDate);
  });

  document.addEventListener("mouseup", async () => {
    if (!isDown) return;
    isDown = false;

    await applySelection();

    startSlot = null;
    currentDate = null;
    mode = "add";
  });
});


