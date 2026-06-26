// BerryPay 8.0 — separated logic
const STORAGE_DAYS = "berrypay_v8_days";
const STORAGE_SETTINGS = "berrypay_v8_settings";

function toast(message) {
  const el = document.getElementById("toast");
  el.textContent = message;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 1800);
}

function defaultSettings() {
  return {
    rate: 12.71,
    otRate: 19.07,
    normKg: 48,
    bonusKg: 0.75,
    standardKg: 1.5,
    rubbishKg: 4,
    goalMoney: 1000,
    goalKg: 400,
    farmName: "East Seaton Farm"
  };
}

function getSettings() {
  return JSON.parse(localStorage.getItem(STORAGE_SETTINGS)) || defaultSettings();
}

function setSettings(settings) {
  localStorage.setItem(STORAGE_SETTINGS, JSON.stringify(settings));
}

function getDays() {
  return JSON.parse(localStorage.getItem(STORAGE_DAYS)) || [];
}

function setDays(days) {
  localStorage.setItem(STORAGE_DAYS, JSON.stringify(days));
}

function money(n) {
  return "£" + (Math.round((n || 0) * 100) / 100).toFixed(2);
}

function hoursText(hours) {
  const m = Math.round((hours || 0) * 60);
  return Math.floor(m / 60) + " ч " + (m % 60) + " мин";
}

function parseTime(value) {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}

function nowTime() {
  const d = new Date();
  return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
}

function iso(date) {
  return date.toISOString().slice(0, 10);
}

function weekStartFriday(dateObj) {
  const d = new Date(dateObj);
  const day = d.getDay();
  const diff = day >= 5 ? day - 5 : day + 2;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function weekByOffset(offset) {
  const base = new Date(document.getElementById("date").value || new Date());
  const start = weekStartFriday(base);
  start.setDate(start.getDate() + offset * 7);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const days = getDays().filter(d => d.date >= iso(start) && d.date <= iso(end));
  return { days, startW: start, endW: end };
}

function payFridayForWeek(week) {
  const p = new Date(week.endW);
  p.setDate(week.endW.getDate() + 8);
  return p;
}

function setStartNow() {
  document.getElementById("start").value = nowTime();
  if (navigator.vibrate) navigator.vibrate(25);
  toast("Начало смены записано");
}

function setEndNow() {
  document.getElementById("end").value = nowTime();
  if (navigator.vibrate) navigator.vibrate(25);
  toast("Конец смены записан");
}

function updateKgFromHarvest() {
  const s = getSettings();
  const standard = +(document.getElementById("standardBoxes").value || 0);
  const rubbish = +(document.getElementById("rubbishBoxes").value || 0);
  document.getElementById("kg").value = (standard * s.standardKg + rubbish * s.rubbishKg).toFixed(2);
}

function calcDay(date, start, end, kgValue) {
  const s = getSettings();
  let startMin = parseTime(start);
  let endMin = parseTime(end);
  if (endMin < startMin) endMin += 1440;

  let breakMin = 0;
  if (startMin < 480 && endMin > 480) breakMin += 15;
  if (startMin < 660 && endMin > 660) breakMin += 30;

  const workHours = Math.max((endMin - startMin - breakMin) / 60, 0);
  const normalHours = Math.min(workHours, 8);
  const overtimeHours = Math.max(workHours - 8, 0);
  const hourlyPay = normalHours * s.rate + overtimeHours * s.otRate;

  const kg = +(kgValue || 0);
  const extraKg = Math.max(kg - s.normKg, 0);
  const bonusPay = extraKg * s.bonusKg;

  return {
    date,
    start,
    end,
    standardBoxes: +(document.getElementById("standardBoxes").value || 0),
    rubbishBoxes: +(document.getElementById("rubbishBoxes").value || 0),
    kg,
    note: document.getElementById("note").value || "",
    breakMin,
    workHours,
    normalHours,
    overtimeHours,
    hourlyPay,
    extraKg,
    bonusPay,
    total: hourlyPay + bonusPay
  };
}

function resultHTML(r) {
  return `
    <div class="mini"><span>Рабочее время</span><b>${hoursText(r.workHours)}</b></div>
    <div class="mini"><span>Овертайм</span><b>${hoursText(r.overtimeHours)}</b></div>
    <div class="mini"><span>ЗП за часы</span><b>${money(r.hourlyPay)}</b></div>
    <div class="mini"><span>Бонус</span><b>${money(r.bonusPay)}</b></div>
    <div class="mini"><span>Стандарт</span><b>${r.standardBoxes || 0}</b></div>
    <div class="mini"><span>Рабиш</span><b>${r.rubbishBoxes || 0}</b></div>
    <div class="mini"><span>Сверх нормы</span><b>${r.extraKg} кг</b></div>
    <div class="mini premiumMini"><span>Итого</span><b>${money(r.total)}</b></div>
  `;
}

function updateTodayHarvestCard(r) {
  const el = document.getElementById("todayHarvestCard");
  if (!el || !r) return;
  el.innerHTML = `
    <div class="mini"><span>Стандарт</span><b>${r.standardBoxes || 0}</b></div>
    <div class="mini"><span>Рабиш</span><b>${r.rubbishBoxes || 0}</b></div>
    <div class="mini"><span>Всего кг</span><b>${r.kg} кг</b></div>
    <div class="mini premiumMini"><span>Сегодня</span><b>${money(r.total)}</b></div>
  `;
}

function calculatePreview() {
  const r = calcDay(
    document.getElementById("date").value,
    document.getElementById("start").value,
    document.getElementById("end").value,
    document.getElementById("kg").value
  );
  document.getElementById("preview").innerHTML = resultHTML(r);
  updateTodayHarvestCard(r);
  return r;
}

function saveDay() {
  const r = calculatePreview();
  if (!r.date || !r.start || !r.end) {
    toast("Заполни дату и время");
    return;
  }
  const days = getDays().filter(d => d.date !== r.date);
  days.push(r);
  days.sort((a, b) => a.date.localeCompare(b.date));
  setDays(days);
  toast("Смена сохранена ✅");
  refreshAll();
}

function loadSettings() {
  const s = getSettings();
  for (const key of ["rate", "otRate", "normKg", "bonusKg", "standardKg", "rubbishKg", "goalMoney", "goalKg", "farmName"]) {
    const el = document.getElementById(key);
    if (el) el.value = s[key];
  }
  document.getElementById("quickGoalMoney").value = s.goalMoney;
  document.getElementById("quickGoalKg").value = s.goalKg;
}

function saveSettings() {
  const settings = {
    rate: +document.getElementById("rate").value || 12.71,
    otRate: +document.getElementById("otRate").value || 19.07,
    normKg: +document.getElementById("normKg").value || 48,
    bonusKg: +document.getElementById("bonusKg").value || 0.75,
    standardKg: +document.getElementById("standardKg").value || 1.5,
    rubbishKg: +document.getElementById("rubbishKg").value || 4,
    goalMoney: +document.getElementById("goalMoney").value || 1000,
    goalKg: +document.getElementById("goalKg").value || 400,
    farmName: document.getElementById("farmName").value || "Farm"
  };
  setSettings(settings);
  document.getElementById("quickGoalMoney").value = settings.goalMoney;
  document.getElementById("quickGoalKg").value = settings.goalKg;
  toast("Настройки сохранены");
  refreshAll();
}

function saveQuickGoals() {
  const s = getSettings();
  s.goalMoney = +document.getElementById("quickGoalMoney").value || 1000;
  s.goalKg = +document.getElementById("quickGoalKg").value || 400;
  setSettings(s);
  document.getElementById("goalMoney").value = s.goalMoney;
  document.getElementById("goalKg").value = s.goalKg;
  toast("Цели сохранены");
  refreshAll();
}

function renderWeek() {
  const current = weekByOffset(0);
  const previous = weekByOffset(-1);
  const s = getSettings();

  const currentTotal = current.days.reduce((a, d) => a + d.total, 0);
  const currentKg = current.days.reduce((a, d) => a + d.kg, 0);
  const previousTotal = previous.days.reduce((a, d) => a + d.total, 0);

  document.getElementById("homeWeekTotal").textContent = money(currentTotal);
  document.getElementById("weekTotal").textContent = money(currentTotal);
  document.getElementById("homeWeekRange").textContent = `${iso(current.startW)} → ${iso(current.endW)}`;
  document.getElementById("weekRange").textContent = `${iso(current.startW)} → ${iso(current.endW)}`;

  document.getElementById("pendingPay").textContent = money(previousTotal);
  document.getElementById("pendingPay2").textContent = money(previousTotal);
  document.getElementById("pendingRange").textContent = `${iso(previous.startW)} → ${iso(previous.endW)}`;
  document.getElementById("pendingRange2").textContent = `${iso(previous.startW)} → ${iso(previous.endW)}`;

  const payDate = "Выплата: пятница, " + iso(payFridayForWeek(previous));
  document.getElementById("pendingDate").textContent = payDate;
  document.getElementById("pendingDate2").textContent = payDate;

  document.getElementById("goalMoneyText").textContent = money(s.goalMoney);
  document.getElementById("goalKgText").textContent = s.goalKg + " кг";
  document.getElementById("moneyBar").style.width = Math.min((currentTotal / s.goalMoney) * 100, 100) + "%";
  document.getElementById("kgBar").style.width = Math.min((currentKg / s.goalKg) * 100, 100) + "%";

  document.getElementById("weekList").innerHTML = current.days.length
    ? current.days.map(d => `
      <div class="row">
        <div><b>${d.date}</b><div class="mutedDark">${d.start}–${d.end}, ${d.standardBoxes ? d.standardBoxes + " ст · " : ""}${d.rubbishBoxes ? d.rubbishBoxes + " раб · " : ""}${d.kg} кг ${d.note ? "· " + d.note : ""}</div></div>
        <div><b>${money(d.total)}</b><div class="mutedDark">${hoursText(d.workHours)}</div></div>
      </div>
    `).join("")
    : '<div class="mutedDark">Пока нет сохранённых дней.</div>';

  renderCalendar(current);
  renderCharts(current);
  renderHistory();
}

function renderCalendar(week) {
  let html = "";
  const start = new Date(week.startW);
  const worked = new Set(week.days.map(d => d.date));
  const today = iso(new Date());

  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const id = iso(d);
    html += `<div class="day ${worked.has(id) ? "worked" : ""} ${id === today ? "todayDay" : ""}">${id.slice(8)}</div>`;
  }
  document.getElementById("calendar").innerHTML = html;
}

function renderCharts(week) {
  const maxPay = Math.max(1, ...week.days.map(d => d.total));
  const payDays = week.days.length ? week.days : [0,0,0,0,0,0,0];
  document.getElementById("earnChart").innerHTML = payDays.map(d => {
    const h = d.total ? Math.max(8, (d.total / maxPay) * 130) : 8;
    return `<div class="col" style="height:${h}px"></div>`;
  }).join("");

  const all = getDays();
  const maxKg = Math.max(1, ...all.map(d => d.kg || 0));
  const kgDays = all.slice(-7).length ? all.slice(-7) : [0,0,0,0,0,0,0];
  document.getElementById("kgChart").innerHTML = kgDays.map(d => {
    const h = d.kg ? Math.max(8, (d.kg / maxKg) * 130) : 8;
    return `<div class="col" style="height:${h}px"></div>`;
  }).join("");
}

function renderHistory() {
  const days = getDays();
  const map = {};
  days.forEach(day => {
    const w = weekStartFriday(new Date(day.date));
    const key = iso(w);
    if (!map[key]) {
      const end = new Date(w);
      end.setDate(w.getDate() + 6);
      map[key] = { start: w, end, total: 0, kg: 0, hours: 0, days: 0, standard: 0, rubbish: 0 };
    }
    map[key].total += day.total;
    map[key].kg += day.kg;
    map[key].hours += day.workHours;
    map[key].days += 1;
    map[key].standard += day.standardBoxes || 0;
    map[key].rubbish += day.rubbishBoxes || 0;
  });

  const rows = Object.values(map).sort((a, b) => b.start - a.start);
  document.getElementById("historyList").innerHTML = rows.length
    ? rows.map(r => `
      <div class="row">
        <div><b>${iso(r.start)} → ${iso(r.end)}</b><div class="mutedDark">${r.days} дн · ${r.standard} ст · ${r.rubbish} раб · ${r.kg.toFixed(1)} кг · ${hoursText(r.hours)}</div></div>
        <div><b>${money(r.total)}</b><div class="mutedDark">выплата ${iso(payFridayForWeek(r))}</div></div>
      </div>
    `).join("")
    : '<div class="mutedDark">История пока пустая.</div>';
}

function renderStats() {
  const days = getDays();
  const sum = key => days.reduce((a, d) => a + (d[key] || 0), 0);
  const maxKg = days.length ? Math.max(...days.map(d => d.kg || 0)) : 0;
  const maxPay = days.length ? Math.max(...days.map(d => d.total || 0)) : 0;
  const avgKg = days.length ? sum("kg") / days.length : 0;

  document.getElementById("statsBox").innerHTML = `
    <div class="mini"><span>Дней</span><b>${days.length}</b></div>
    <div class="mini"><span>Всего часов</span><b>${hoursText(sum("workHours"))}</b></div>
    <div class="mini"><span>Овертайм</span><b>${hoursText(sum("overtimeHours"))}</b></div>
    <div class="mini"><span>Всего кг</span><b>${sum("kg").toFixed(1)}</b></div>
    <div class="mini"><span>Всего стандарт</span><b>${sum("standardBoxes").toFixed(1)}</b></div>
    <div class="mini"><span>Всего рабиш</span><b>${sum("rubbishBoxes").toFixed(1)}</b></div>
    <div class="mini"><span>Среднее кг</span><b>${avgKg.toFixed(1)}</b></div>
    <div class="mini"><span>Рекорд кг</span><b>${maxKg.toFixed(1)}</b></div>
    <div class="mini"><span>Лучший день</span><b>${money(maxPay)}</b></div>
    <div class="mini premiumMini"><span>Всего</span><b>${money(sum("total"))}</b></div>
  `;

  document.getElementById("recordsBox").innerHTML = `
    <div class="mini"><span>Лучший кг</span><b>${maxKg.toFixed(1)}</b></div>
    <div class="mini"><span>Лучший доход</span><b>${money(maxPay)}</b></div>
    <div class="mini"><span>Дней</span><b>${days.length}</b></div>
    <div class="mini premiumMini"><span>Сезон</span><b>${money(sum("total"))}</b></div>
  `;

  const s = getSettings();
  document.getElementById("farmBox").innerHTML = `
    <div class="row"><span>📍 Ферма</span><b>${s.farmName}</b></div>
    <div class="row"><span>Ставка</span><b>${money(s.rate)}/ч</b></div>
    <div class="row"><span>Овертайм</span><b>${money(s.otRate)}/ч</b></div>
    <div class="row"><span>Норма</span><b>${s.normKg} кг</b></div>
    <div class="row"><span>Бонус</span><b>${money(s.bonusKg)}/кг</b></div>
    <div class="row"><span>Вес стандарта</span><b>${s.standardKg} кг</b></div>
    <div class="row"><span>Вес рабиш</span><b>${s.rubbishKg} кг</b></div>
    <div class="row"><span>Задержка выплаты</span><b>1 неделя</b></div>
  `;
}

function comparePay() {
  const previous = weekByOffset(-1);
  const should = previous.days.reduce((a, d) => a + d.total, 0);
  const paid = +document.getElementById("paidAmount").value || 0;
  const diff = paid - should;
  document.getElementById("payCompare").innerHTML = `
    <div class="card">
      <b>${diff >= 0 ? "✅ Всё нормально" : "⚠️ Не хватает"}</b>
      <p class="mutedDark">${diff >= 0 ? "Больше/ровно на " + money(diff) : "Разница: " + money(Math.abs(diff))}</p>
    </div>
  `;
}

function exportCSV() {
  const days = getDays();
  let csv = "Date,Start,End,Standard,Rubbish,Kg,Hours,Overtime,HourlyPay,Bonus,Total,Note\n";
  days.forEach(d => {
    csv += [
      d.date, d.start, d.end, d.standardBoxes || 0, d.rubbishBoxes || 0, d.kg,
      d.workHours.toFixed(2), d.overtimeHours.toFixed(2), d.hourlyPay.toFixed(2),
      d.bonusPay.toFixed(2), d.total.toFixed(2), '"' + (d.note || "") + '"'
    ].join(",") + "\n";
  });
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "berrypay-report.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function clearAll() {
  if (confirm("Delete all?")) {
    localStorage.removeItem(STORAGE_DAYS);
    refreshAll();
    toast("Все записи удалены");
  }
}

function refreshAll() {
  renderWeek();
  renderStats();
}

function showTab(id, btn) {
  document.querySelectorAll("section").forEach(section => section.classList.add("hidden"));
  document.getElementById(id).classList.remove("hidden");
  document.querySelectorAll(".tab").forEach(tab => tab.classList.remove("active"));
  btn.classList.add("active");
  refreshAll();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function toggleLang() {
  const btn = document.getElementById("langBtn");
  btn.textContent = btn.textContent === "RU" ? "EN" : "RU";
}

function init() {
  document.getElementById("date").value = new Date().toISOString().slice(0, 10);
  loadSettings();
  refreshAll();
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  }
}

init();
