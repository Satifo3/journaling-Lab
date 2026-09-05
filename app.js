(() => {
  const STORAGE_KEY = "journal-labs-local-v3";
  const VOICE_FILES = {
    start25: "assets/voice/start_25.wav",
    start50: "assets/voice/start_50.wav",
    mid5: "assets/voice/remaining_5.wav",
    finish25: "assets/voice/finish_25.wav",
    finish50: "assets/voice/finish_50.wav"
  };
  const VOICE_TEXT = {
    start25: "それじゃあ25分、集中していきましょう！",
    start50: "それじゃあ50分、集中していきましょう！",
    mid5: "あと5分です！もうひと頑張りいきましょう！",
    finish25: "お疲れ様です！ちょっと立ち上がってストレッチしましょう！",
    finish50: "50分集中できました！少し長めに休憩してくださいね！"
  };
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];

  const state = loadState();
  normalizeState();

  let current = new Date();
  current.setDate(1);
  let journalMode = "journal";
  let timerSeconds = 25 * 60;
  let timerTotal = 25 * 60;
  let timerInterval = null;
  let ambient = null;
  let bgmPreview = false;
  let voicePlayer = null;
  let voicePlayedMid = false;
  let voiceAvailability = {};

  function defaultState(){
    return {
      months:{},
      habits:[
        {id:crypto.randomUUID(), name:"ストレッチ", short:"S"},
        {id:crypto.randomUUID(), name:"アニメ", short:"ア"},
        {id:crypto.randomUUID(), name:"Aパート", short:"A"},
        {id:crypto.randomUUID(), name:"Bパート", short:"B"}
      ],
      sound:"river",
      volume:35,
      voice:{enabled:true,start:true,mid:true,finish:true,volume:80}
    };
  }
  function normalizeState(){
    state.months ||= {};
    state.habits ||= defaultState().habits;
    state.sound ||= "river";
    state.volume ??= 35;
    state.voice ||= {enabled:true,start:true,mid:true,finish:true,volume:80};
  }
  function loadState(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      if(!raw) return defaultState();
      return {...defaultState(), ...JSON.parse(raw)};
    }catch(e){ return defaultState(); }
  }
  function saveState(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  function monthKey(date=current){ return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}`; }
  function ensureMonth(key=monthKey()){
    if(!state.months[key]) state.months[key] = {goal:"", entries:{}, daily:{}, habits:{}, ratings:{}, tasks:[]};
    state.months[key].entries ||= {};
    state.months[key].daily ||= {};
    state.months[key].habits ||= {};
    state.months[key].ratings ||= {};
    state.months[key].tasks ||= [];
    return state.months[key];
  }
  function daysInMonth(){ return new Date(current.getFullYear(), current.getMonth()+1, 0).getDate(); }
  function pad(n){ return String(n).padStart(2,"0"); }
  function dateKey(day){ return `${current.getFullYear()}-${pad(current.getMonth()+1)}-${pad(day)}`; }
  function formatDay(day){
    const d = new Date(current.getFullYear(), current.getMonth(), day);
    const w = ["日","月","火","水","木","金","土"][d.getDay()];
    return {weekday:w, sunday:d.getDay()===0};
  }
  function escapeHtml(s=""){ return String(s).replace(/[&<>"']/g, m => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m])); }
  function escapeAttr(s=""){ return escapeHtml(s); }

  function renderAll(){
    const m = ensureMonth();
    $("#monthTitle").textContent = `${current.getMonth()+1}月`;
    $("#monthGoal").value = m.goal || "";
    renderJournal();
    renderDaily();
    renderHabits();
    renderTracker();
    renderTasks();
    applySoundUI();
  }

  function renderJournal(){
    $("#journalPanelTitle").textContent = journalMode === "journal" ? "月間ジャーナル" : "デイリータスク";
    $("#journalList").classList.toggle("hidden", journalMode !== "journal");
    $("#dailyList").classList.toggle("hidden", journalMode !== "daily");
    const m = ensureMonth();
    const wrap = $("#journalList");
    wrap.innerHTML = "";
    for(let day=1; day<=daysInMonth(); day++){
      const key = dateKey(day);
      const entry = m.entries[key] || {text:""};
      const {weekday, sunday} = formatDay(day);
      const row = document.createElement("div");
      row.className = "journal-row" + (sunday ? " sunday" : "");
      row.innerHTML = `<div class="daynum">${day}</div><div class="weekday">${weekday}</div><textarea class="journal-text" data-day="${day}" rows="1" placeholder="1行で記録">${escapeHtml(entry.text || "")}</textarea>`;
      wrap.appendChild(row);
    }
    $$(".journal-text").forEach(el => el.addEventListener("input", e => {
      const day = +e.target.dataset.day;
      const key = dateKey(day);
      const m = ensureMonth();
      m.entries[key] ||= {text:""};
      m.entries[key].text = e.target.value;
      saveState();
    }));
  }

  function renderDaily(){
    const m = ensureMonth();
    const wrap = $("#dailyList");
    wrap.innerHTML = "";
    for(let day=1; day<=daysInMonth(); day++){
      const key = dateKey(day);
      const item = m.daily[key] || {text:"", done:false};
      const {weekday, sunday} = formatDay(day);
      const row = document.createElement("div");
      row.className = "daily-row" + (sunday ? " sunday" : "");
      row.innerHTML = `<div class="daynum">${day}</div><div class="weekday">${weekday}</div><input class="daily-text" data-dday="${day}" type="text" placeholder="その日のやること" value="${escapeAttr(item.text || "")}"><button class="daily-check ${item.done ? "on" : ""}" data-dcheck="${day}">${item.done ? "✓" : ""}</button>`;
      wrap.appendChild(row);
    }
    $$(".daily-text").forEach(el => el.addEventListener("input", e => {
      const day = +e.target.dataset.dday;
      const key = dateKey(day);
      const m = ensureMonth();
      m.daily[key] ||= {text:"", done:false};
      m.daily[key].text = e.target.value;
      saveState();
    }));
    $$("[data-dcheck]").forEach(btn => btn.addEventListener("click", () => {
      const day = +btn.dataset.dcheck;
      const key = dateKey(day);
      const m = ensureMonth();
      m.daily[key] ||= {text:"", done:false};
      m.daily[key].done = !m.daily[key].done;
      saveState();
      renderDaily();
    }));
  }

  function renderHabits(){
    const m = ensureMonth();
    const habits = state.habits;
    const wrap = $("#habitTracker");
    wrap.innerHTML = "";
    if(!habits.length){
      wrap.innerHTML = `<p class="muted">「編集」から項目を追加してください。</p>`;
      return;
    }
    const table = document.createElement("div");
    table.className = "habit-table";
    table.style.setProperty("--habit-count", habits.length);
    const head = document.createElement("div");
    head.className = "habit-head";
    head.innerHTML = `<div></div>` + habits.map(h => `<div class="habit-label" title="${escapeAttr(h.name)}">${escapeHtml(h.short || h.name.slice(0,1))}</div>`).join("");
    table.appendChild(head);
    for(let day=1; day<=daysInMonth(); day++){
      const key = dateKey(day);
      m.habits[key] ||= {};
      const row = document.createElement("div");
      row.className = "habit-day";
      row.style.setProperty("--habit-count", habits.length);
      row.innerHTML = `<div class="habit-date">${day}</div>` + habits.map(h => {
        const on = !!m.habits[key][h.id];
        return `<button class="habit-cell ${on ? "on" : ""}" data-hday="${day}" data-hid="${h.id}" title="${escapeAttr(h.name)}"></button>`;
      }).join("");
      table.appendChild(row);
    }
    wrap.appendChild(table);
    $$(".habit-cell").forEach(btn => btn.addEventListener("click", () => {
      const day = +btn.dataset.hday;
      const hid = btn.dataset.hid;
      const key = dateKey(day);
      const m = ensureMonth();
      m.habits[key] ||= {};
      m.habits[key][hid] = !m.habits[key][hid];
      saveState();
      renderHabits();
    }));
  }

  function renderHabitEditor(){
    const wrap = $("#habitEditor");
    wrap.innerHTML = "";
    state.habits.forEach(h => addHabitEditorRow(h.name, h.short, h.id));
  }
  function addHabitEditorRow(name="", short="", id=""){
    const row = document.createElement("div");
    row.className = "habit-edit-row";
    row.innerHTML = `<label>項目名<input class="habit-name" value="${escapeAttr(name)}" placeholder="例：筋トレ"></label><label>略称<input class="habit-short" value="${escapeAttr(short)}" maxlength="2" placeholder="筋"></label><button type="button" class="danger-btn remove-habit">削除</button><input type="hidden" class="habit-id" value="${escapeAttr(id)}">`;
    row.querySelector(".remove-habit").addEventListener("click", ()=>row.remove());
    $("#habitEditor").appendChild(row);
  }

  function renderTracker(){
    const today = new Date();
    $("#todayLabel").textContent = `${today.getMonth()+1}月${today.getDate()}日`;
    const targetDay = (today.getFullYear()===current.getFullYear() && today.getMonth()===current.getMonth()) ? today.getDate() : 1;
    const key = dateKey(targetDay);
    const m = ensureMonth();
    m.ratings[key] ||= {body:null, sleepHours:null};
    renderBodyRating(m.ratings[key].body, targetDay);
    renderSleepHours(m.ratings[key].sleepHours, targetDay);
    drawMiniChart("#bodyChart", "body", 1, 5, "#3b6fa7");
    drawMiniChart("#sleepChart", "sleepHours", 0, 10, "#b86868");
    renderTrend();
  }

  function renderBodyRating(value, day){
    const wrap = $("#bodyRating");
    wrap.innerHTML = "";
    for(let i=1; i<=5; i++){
      const btn = document.createElement("button");
      btn.className = `rating-btn ${value===i ? "active body" : ""}`;
      btn.textContent = i;
      btn.addEventListener("click", () => {
        const key = dateKey(day);
        const m = ensureMonth();
        m.ratings[key] ||= {body:null, sleepHours:null};
        m.ratings[key].body = i;
        saveState();
        renderTracker();
      });
      wrap.appendChild(btn);
    }
  }

  function renderSleepHours(value, day){
    const wrap = $("#sleepHours");
    wrap.innerHTML = "";
    for(let i=0; i<=10; i++){
      const btn = document.createElement("button");
      btn.className = `sleep-btn ${value===i ? "active" : ""}`;
      btn.textContent = `${i}h`;
      btn.addEventListener("click", () => {
        const key = dateKey(day);
        const m = ensureMonth();
        m.ratings[key] ||= {body:null, sleepHours:null};
        m.ratings[key].sleepHours = i;
        saveState();
        renderTracker();
      });
      wrap.appendChild(btn);
    }
  }

  function drawMiniChart(selector, keyName, minVal, maxVal, color){
    const canvas = $(selector);
    const ctx = canvas.getContext("2d");
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0,0,W,H);
    const left = 48, right = 24, top = 32, bottom = 28;
    const chartW = W - left - right;
    const chartH = H - top - bottom;
    ctx.strokeStyle = "rgba(90,130,125,.25)";
    ctx.fillStyle = "#6a8286";
    ctx.lineWidth = 1;
    ctx.font = "16px -apple-system, sans-serif";
    const range = maxVal - minVal || 1;
    for(let v=minVal; v<=maxVal; v++){
      const x = left + ((v-minVal)/range) * chartW;
      ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, H-bottom); ctx.stroke();
      ctx.fillText(String(v), x-5, 18);
    }
    const days = daysInMonth();
    [1,5,10,15,20,25,days].filter((v,i,a)=>a.indexOf(v)===i).forEach(day=>{
      const y = top + ((day-1)/(Math.max(1,days-1))) * chartH;
      ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(W-right, y); ctx.stroke();
      ctx.fillText(String(day), 14, y+5);
    });
    const points = [];
    const m = ensureMonth();
    for(let d=1; d<=days; d++){
      const val = m.ratings[dateKey(d)]?.[keyName];
      if(val !== null && val !== undefined){
        points.push({
          x: left + ((val-minVal)/range) * chartW,
          y: top + ((d-1)/(Math.max(1,days-1))) * chartH
        });
      }
    }
    if(!points.length) return;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 4;
    ctx.beginPath();
    points.forEach((p,i)=> i ? ctx.lineTo(p.x,p.y) : ctx.moveTo(p.x,p.y));
    ctx.stroke();
    points.forEach(p => { ctx.beginPath(); ctx.arc(p.x,p.y,6,0,Math.PI*2); ctx.fill(); });
  }

  function renderTrend(){
    const ratings = Object.values(ensureMonth().ratings);
    const bodyVals = ratings.map(r=>r.body).filter(v=>v!==null && v!==undefined);
    const sleepVals = ratings.map(r=>r.sleepHours).filter(v=>v!==null && v!==undefined);
    const avg = arr => arr.length ? arr.reduce((a,b)=>a+b,0) / arr.length : null;
    const bodyAvg = avg(bodyVals);
    const sleepAvg = avg(sleepVals);
    const parts = [];
    if(bodyAvg !== null) parts.push(`体調の平均は ${bodyAvg.toFixed(1)} / 5`);
    if(sleepAvg !== null) parts.push(`睡眠の平均は ${sleepAvg.toFixed(1)} 時間`);
    $("#trendText").textContent = parts.length ? parts.join("、") + " です。" : "記録が増えると、ここに今月の平均が表示されます。";
  }

  function renderTasks(){
    const m = ensureMonth();
    const wrap = $("#taskList");
    wrap.innerHTML = "";
    if(!m.tasks.length){
      wrap.innerHTML = '<p class="muted">今月のタスクはまだありません。</p>';
      return;
    }
    m.tasks.forEach((t,i) => {
      const row = document.createElement("div");
      row.className = "task-item" + (t.done ? " done" : "");
      row.innerHTML = `<input type="checkbox" ${t.done ? "checked" : ""} data-task-check="${i}"><input type="text" value="${escapeAttr(t.text)}" data-task-text="${i}"><button class="icon-btn" data-task-del="${i}">×</button>`;
      wrap.appendChild(row);
    });
    $$("[data-task-check]").forEach(el=>el.addEventListener("change",()=>{
      m.tasks[+el.dataset.taskCheck].done = el.checked;
      saveState();
      renderTasks();
    }));
    $$("[data-task-text]").forEach(el=>el.addEventListener("input",()=>{
      m.tasks[+el.dataset.taskText].text = el.value;
      saveState();
    }));
    $$("[data-task-del]").forEach(el=>el.addEventListener("click",()=>{
      m.tasks.splice(+el.dataset.taskDel,1);
      saveState();
      renderTasks();
    }));
  }

  function setView(name){
    $$(".tab").forEach(b => b.classList.toggle("active", b.dataset.view===name));
    $$(".view").forEach(v => v.classList.toggle("active", v.id===`view-${name}`));
    if(name === "tracker"){
      setTimeout(() => {
        drawMiniChart("#bodyChart", "body", 1, 5, "#3b6fa7");
        drawMiniChart("#sleepChart", "sleepHours", 0, 10, "#b86868");
      }, 30);
    }
  }
  function setJournalMode(mode){
    journalMode = mode;
    $$("#journalMode .seg").forEach(b => b.classList.toggle("active", b.dataset.mode===mode));
    renderJournal();
  }

  function soundName(sound){
    return {river:"川のせせらぎ", fire:"焚き火", ocean:"海の波", rain:"雨音", off:"無音"}[sound] || "BGM";
  }
  function applySoundUI(){
    $("#volumeControl").value = state.volume;
    $("#volumeValue").textContent = `${state.volume}%`;
    $$("#soundGrid .sound-btn").forEach(b => b.classList.toggle("active", b.dataset.sound===state.sound));
    $("#bgmStatus").textContent = bgmPreview ? `BGM再生中：${soundName(state.sound)}` : (state.sound === "off" ? "BGM無音" : `選択中：${soundName(state.sound)}`);
  }
  function ensureAmbient(){
    if(ambient) return ambient;
    ambient = createAmbientEngine();
    return ambient;
  }
  function toggleBgmPreview(force){
    bgmPreview = typeof force === "boolean" ? force : !bgmPreview;
    if(state.sound === "off") bgmPreview = false;
    const engine = ensureAmbient();
    if(bgmPreview) engine.start(state.sound, state.volume/100);
    else engine.stop();
    applySoundUI();
  }

  async function checkVoiceFiles(){
    let ok = 0;
    for(const [key, path] of Object.entries(VOICE_FILES)){
      try{
        const r = await fetch(path, {method:"HEAD", cache:"no-store"});
        voiceAvailability[key] = r.ok;
        if(r.ok) ok++;
      }catch(e){ voiceAvailability[key] = false; }
    }
    $("#voiceStatus").textContent = ok ? `WAV検出 ${ok}/5。無い分はiPhone音声で代替します。` : "WAV未検出。iPhoneの日本語音声で代替します。";
  }
  function shouldPlayVoice(kind){
    if(!state.voice.enabled) return false;
    if(kind.startsWith("start")) return !!state.voice.start;
    if(kind === "mid5") return !!state.voice.mid;
    if(kind.startsWith("finish")) return !!state.voice.finish;
    return true;
  }
  function playVoice(kind){
    if(!shouldPlayVoice(kind)) return;
    if(voicePlayer){ try{ voicePlayer.pause(); }catch(e){} voicePlayer = null; }
    if(voiceAvailability[kind]){
      voicePlayer = new Audio(VOICE_FILES[kind]);
      voicePlayer.volume = Math.max(0, Math.min(1, (state.voice.volume ?? 80) / 100));
      voicePlayer.play().catch(()=>{});
      return;
    }
    if("speechSynthesis" in window){
      window.speechSynthesis.cancel();
      const uttr = new SpeechSynthesisUtterance(VOICE_TEXT[kind]);
      uttr.lang = "ja-JP";
      uttr.volume = Math.max(0, Math.min(1, (state.voice.volume ?? 80) / 100));
      uttr.rate = 1.0;
      uttr.pitch = 1.15;
      const voices = window.speechSynthesis.getVoices();
      const ja = voices.find(v => /ja-JP|Kyoko|Otoya|Japanese/i.test(`${v.lang} ${v.name}`));
      if(ja) uttr.voice = ja;
      window.speechSynthesis.speak(uttr);
    }
  }

  function updateTimer(){
    const m = Math.floor(timerSeconds / 60);
    const s = timerSeconds % 60;
    $("#timerDisplay").textContent = `${pad(m)}:${pad(s)}`;
    const progress = 1 - (timerSeconds / timerTotal);
    $("#timerRing").style.borderTopColor = progress > 0.66 ? "#b86868" : (progress > 0.33 ? "#2a8f92" : "#11797d");
  }
  function startTimer(){
    if(timerInterval) return;
    if(state.sound !== "off"){
      bgmPreview = false;
      ensureAmbient().start(state.sound, state.volume/100);
      applySoundUI();
    }
    if(timerSeconds === timerTotal){
      voicePlayedMid = false;
      playVoice(timerTotal === 50*60 ? "start50" : "start25");
    }
    timerInterval = setInterval(() => {
      timerSeconds--;
      updateTimer();
      if(timerSeconds === 5*60 && !voicePlayedMid){
        voicePlayedMid = true;
        playVoice("mid5");
      }
      if(timerSeconds <= 0){
        clearInterval(timerInterval);
        timerInterval = null;
        ensureAmbient().stop();
        playVoice(timerTotal === 50*60 ? "finish50" : "finish25");
        setTimeout(()=>alert("集中時間が終了しました。今日の1行日記を残してみてください。"), 500);
      }
    }, 1000);
  }
  function pauseTimer(){
    if(timerInterval){ clearInterval(timerInterval); timerInterval = null; }
    ensureAmbient().stop();
  }
  function resetTimer(){
    pauseTimer();
    timerSeconds = timerTotal;
    voicePlayedMid = false;
    updateTimer();
  }

  function createAmbientEngine(){
    let ctx = null, master = null, nodes = [];
    function init(){
      if(ctx) return;
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = 0.35;
      master.connect(ctx.destination);
    }
    function stop(){
      nodes.forEach(n => {
        try{ n.stop?.(); }catch(e){}
        try{ n.disconnect?.(); }catch(e){}
      });
      nodes = [];
    }
    function noiseBuffer(seconds=2){
      const len = ctx.sampleRate * seconds;
      const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for(let i=0; i<len; i++) data[i] = Math.random()*2 - 1;
      return buffer;
    }
    function sourceNoise(){
      const s = ctx.createBufferSource();
      s.buffer = noiseBuffer(2);
      s.loop = true;
      return s;
    }
    function start(type, volume){
      init();
      stop();
      if(type === "off") return;
      master.gain.value = volume;
      const s = sourceNoise();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      if(type === "rain"){ filter.type = "highpass"; filter.frequency.value = 2500; gain.gain.value = 0.42; }
      else if(type === "river"){ filter.type = "bandpass"; filter.frequency.value = 900; filter.Q.value = 0.5; gain.gain.value = 0.33; }
      else if(type === "ocean"){
        filter.type = "lowpass"; filter.frequency.value = 650; gain.gain.value = 0.45;
        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        lfo.frequency.value = 0.11;
        lfoGain.gain.value = 0.22;
        lfo.connect(lfoGain); lfoGain.connect(gain.gain); lfo.start();
        nodes.push(lfo, lfoGain);
      }else if(type === "fire"){ filter.type = "lowpass"; filter.frequency.value = 1200; gain.gain.value = 0.28; }
      s.connect(filter); filter.connect(gain); gain.connect(master); s.start();
      nodes.push(s, filter, gain);
    }
    return {start, stop};
  }

  function setupEvents(){
    $$(".tab").forEach(b => b.addEventListener("click", () => setView(b.dataset.view)));
    $("#monthGoal").addEventListener("input", e => { ensureMonth().goal = e.target.value; saveState(); });
    $("#prevMonth").addEventListener("click", () => { current.setMonth(current.getMonth()-1); renderAll(); });
    $("#nextMonth").addEventListener("click", () => { current.setMonth(current.getMonth()+1); renderAll(); });
    $$("#journalMode .seg").forEach(b => b.addEventListener("click", () => { journalMode = b.dataset.mode; setJournalMode(journalMode); }));
    $("#quickAdd").addEventListener("click", () => {
      $("#quickDate").value = new Date().toISOString().slice(0,10);
      $("#quickText").value = "";
      $("#quickDialog").showModal();
    });
    $("#saveQuick").addEventListener("click", () => {
      const d = $("#quickDate").value;
      const text = $("#quickText").value.trim();
      if(!d || !text) return;
      const [y, mo] = d.split("-").map(Number);
      const mk = `${y}-${pad(mo)}`;
      if(!state.months[mk]) state.months[mk] = {goal:"", entries:{}, daily:{}, habits:{}, ratings:{}, tasks:[]};
      state.months[mk].entries[d] = {text};
      saveState();
      current = new Date(y, mo-1, 1);
      renderAll();
    });
    $("#editHabits").addEventListener("click", () => { renderHabitEditor(); $("#habitDialog").showModal(); });
    $("#addHabitRow").addEventListener("click", () => addHabitEditorRow());
    $("#saveHabits").addEventListener("click", () => {
      const rows = [...$("#habitEditor").children];
      const next = [];
      rows.forEach(r => {
        const name = r.querySelector(".habit-name").value.trim();
        const short = r.querySelector(".habit-short").value.trim();
        const id = r.querySelector(".habit-id").value || crypto.randomUUID();
        if(name) next.push({id, name, short: short || name.slice(0,1)});
      });
      state.habits = next;
      saveState();
      renderHabits();
    });
    $("#addTask").addEventListener("click", () => {
      ensureMonth().tasks.push({text:"新しいタスク", done:false});
      saveState();
      renderTasks();
    });
    $$("#timerPresets .seg").forEach(b => b.addEventListener("click", () => {
      if(timerInterval) return;
      $$("#timerPresets .seg").forEach(x => x.classList.toggle("active", x===b));
      timerTotal = +b.dataset.minutes * 60;
      timerSeconds = timerTotal;
      updateTimer();
    }));
    $("#startTimer").addEventListener("click", startTimer);
    $("#pauseTimer").addEventListener("click", pauseTimer);
    $("#resetTimer").addEventListener("click", resetTimer);
    $("#toggleBgmPreview").addEventListener("click", () => toggleBgmPreview());
    $("#volumeControl").addEventListener("input", e => {
      state.volume = +e.target.value;
      saveState();
      if(bgmPreview) toggleBgmPreview(true);
      applySoundUI();
    });
    $$("#soundGrid .sound-btn").forEach(b => b.addEventListener("click", () => {
      state.sound = b.dataset.sound;
      saveState();
      if(state.sound === "off") bgmPreview = false;
      else bgmPreview = true;
      toggleBgmPreview(bgmPreview);
    }));
    $("#voiceTest").addEventListener("click", () => playVoice("start25"));
    $$(".voice-line-btn").forEach(btn => btn.addEventListener("click", () => playVoice(btn.dataset.line)));
    $("#saveFocusNote").addEventListener("click", () => {
      const text = $("#focusNote").value.trim();
      if(!text) return;
      const now = new Date();
      const mk = `${now.getFullYear()}-${pad(now.getMonth()+1)}`;
      const dk = `${mk}-${pad(now.getDate())}`;
      state.months[mk] ||= {goal:"", entries:{}, daily:{}, habits:{}, ratings:{}, tasks:[]};
      const old = state.months[mk].entries[dk]?.text || "";
      state.months[mk].entries[dk] = {text: old ? `${old}\n${text}` : text};
      $("#focusNote").value = "";
      saveState();
      alert("今日の1行日記に追加しました。");
      if(current.getFullYear()===now.getFullYear() && current.getMonth()===now.getMonth()) renderJournal();
    });
    $("#voiceEnabled").checked = !!state.voice.enabled;
    $("#voiceStartEnabled").checked = !!state.voice.start;
    $("#voiceMidEnabled").checked = !!state.voice.mid;
    $("#voiceFinishEnabled").checked = !!state.voice.finish;
    $("#voiceVolume").value = state.voice.volume ?? 80;
    $("#voiceVolumeValue").textContent = `${state.voice.volume ?? 80}%`;
    $("#voiceEnabled").addEventListener("change", e => { state.voice.enabled = e.target.checked; saveState(); });
    $("#voiceStartEnabled").addEventListener("change", e => { state.voice.start = e.target.checked; saveState(); });
    $("#voiceMidEnabled").addEventListener("change", e => { state.voice.mid = e.target.checked; saveState(); });
    $("#voiceFinishEnabled").addEventListener("change", e => { state.voice.finish = e.target.checked; saveState(); });
    $("#voiceVolume").addEventListener("input", e => {
      state.voice.volume = +e.target.value;
      $("#voiceVolumeValue").textContent = `${state.voice.volume}%`;
      saveState();
    });
    $("#exportData").addEventListener("click", () => {
      const blob = new Blob([JSON.stringify(state, null, 2)], {type:"application/json"});
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `journal-labs-backup-${new Date().toISOString().slice(0,10)}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
    });
    $("#importData").addEventListener("change", async e => {
      const file = e.target.files?.[0];
      if(!file) return;
      try{
        const parsed = JSON.parse(await file.text());
        localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
        location.reload();
      }catch(err){ alert("JSONを読み込めませんでした。"); }
    });
    $("#clearData").addEventListener("click", () => {
      if(confirm("すべての記録を削除します。元に戻せません。")){
        localStorage.removeItem(STORAGE_KEY);
        location.reload();
      }
    });
  }

  setupEvents();
  setJournalMode("journal");
  renderAll();
  updateTimer();
  checkVoiceFiles();
})();