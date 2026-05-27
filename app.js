/**
 * 和拖延say拜拜 v2 — 主应用逻辑
 */
const App = (() => {
  const STORAGE_KEY = 'pb_data_v2';
  let state, timerInterval, timerStartTime, timerTotalSec = 300;

  // ===== 数据层 =====
  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return defaults();
  }
  function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  function defaults() {
    return {
      tasks: [], currentTaskId: null,
      pet: { mood: 80, growth: 0, lastFed: today() },
      badges: [],
      stats: { totalCompleted: 0, streak: 0, todayCompleted: 0, lastActiveDate: null }
    };
  }

  // ===== 勋章 =====
  const BADGES = [
    { id:'first',  name:'起步',     icon:'🌱', check:s=>s.totalCompleted>=1 },
    { id:'three',  name:'行动派',   icon:'🏃', check:s=>s.totalCompleted>=3 },
    { id:'five',   name:'效率达人', icon:'⚡', check:s=>s.totalCompleted>=5 },
    { id:'ten',    name:'超级战士', icon:'💪', check:s=>s.totalCompleted>=10 },
    { id:'streak3',name:'三天打鱼', icon:'🔥', check:s=>s.streak>=3 },
    { id:'streak7',name:'一周坚持', icon:'🏆', check:s=>s.streak>=7 },
    { id:'pet2',   name:'养育达人', icon:'🐾', check:s=>PetSystem.getLevel(s.growth||0).level>=2 },
    { id:'today5', name:'今日之星', icon:'⭐', check:s=>s.todayCompleted>=5 },
  ];

  // ===== 工具 =====
  const today = () => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
  const uid = () => Date.now().toString(36)+Math.random().toString(36).slice(2,6);
  const $ = id => document.getElementById(id);
  const $$ = sel => document.querySelectorAll(sel);
  const diffLabel = d => ({easy:'简单',medium:'中等',hard:'困难'}[d]||d);

  // ===== 初始化 =====
  function init() {
    state = load();
    checkStreak();
    PetSystem.decayMood(state.pet);
    renderAll();
    bindEvents();
    save();
  }

  function checkStreak() {
    const t = today();
    if (state.stats.lastActiveDate === t) return;
    const y = new Date(Date.now()-86400000).toISOString().split('T')[0];
    if (state.stats.lastActiveDate !== y) {
      state.stats.streak = 0;
      state.stats.todayCompleted = 0;
    }
  }

  // ===== 事件绑定 =====
  function bindEvents() {
    const input = $('taskInput');
    input.addEventListener('keydown', e => { if(e.key==='Enter') decompose(); });
    $('btnDecompose').addEventListener('click', decompose);

    // 模板
    $$('.tpl-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        const map = {论文:'写一篇3000字课程论文',复习:'期末考试复习',小组:'小组作业汇报准备',技能:'学习一个新技能',整理:'整理房间和桌面'};
        input.value = map[btn.dataset.template]||'';
        decompose();
      });
    });

    // 难度
    $$('#diffPills .pill').forEach(p => {
      p.addEventListener('click', () => {
        $$('#diffPills .pill').forEach(x=>x.classList.remove('active'));
        p.classList.add('active');
      });
    });

    // 任务操作
    $('btnStart5min').addEventListener('click', startTimer);
    $('btnEditSteps').addEventListener('click', openEdit);
    $('btnRedo').addEventListener('click', decompose);

    // 弹窗
    $('btnTimerCancel').addEventListener('click', cancelTimer);
    $('btnTimerContinue').addEventListener('click', continueTimer);
    $('btnCelebrateClose').addEventListener('click', () => closeOverlay('celebrateModal'));
    $('btnEditCancel').addEventListener('click', () => closeOverlay('editModal'));
    $('btnEditSave').addEventListener('click', saveEdit);
    $('btnAddStep').addEventListener('click', addEditRow);

    // 点击overlay背景关闭
    $$('.overlay').forEach(ov => {
      ov.addEventListener('click', e => { if(e.target===ov) ov.classList.remove('open'); });
    });
  }

  // ===== 任务拆解 =====
  function decompose() {
    const input = $('taskInput');
    const title = input.value.trim();
    if (!title) { input.classList.add('shake'); setTimeout(()=>input.classList.remove('shake'),300); return; }

    const diff = document.querySelector('#diffPills .pill.active')?.dataset.diff || 'easy';
    const result = MockAI.decompose(title, diff);
    if (!result) return;

    const task = { id:uid(), title:result.title, steps:result.steps, encouragement:result.encouragement, difficulty:diff, createdAt:new Date().toISOString(), completedAt:null };
    state.tasks.unshift(task);
    state.currentTaskId = task.id;
    input.value = '';
    save();
    renderTask();
    renderHistory();
    setSpeech(result.encouragement);
  }

  // ===== 步骤切换 =====
  function toggleStep(stepId) {
    const task = currentTask();
    if (!task) return;
    const step = task.steps.find(s=>s.id===stepId);
    if (!step) return;
    step.done = !step.done;
    if (step.done) state.pet.mood = Math.min(100, state.pet.mood+3);
    if (task.steps.every(s=>s.done)) completeTask(task);
    save();
    renderTask();
    renderPet();
    renderStats();
  }

  // ===== 完成任务 =====
  function completeTask(task) {
    task.completedAt = new Date().toISOString();
    state.stats.totalCompleted++;
    state.stats.todayCompleted++;
    state.stats.lastActiveDate = today();

    const oldLvl = PetSystem.getLevel(state.pet.growth).level;
    const result = PetSystem.feed(state.pet, task.difficulty);
    const newLvl = PetSystem.getLevel(state.pet.growth);
    const levelUp = newLvl.level > oldLvl;

    const newBadges = [];
    BADGES.forEach(b => {
      if (!state.badges.includes(b.id) && b.check({...state.stats, growth:state.pet.growth})) {
        state.badges.push(b.id);
        newBadges.push(b);
      }
    });
    save();

    // 庆祝弹窗
    const rewards = [
      {emoji:'🍎', text:`+${result.growthGained} 成长`},
      {emoji:'💖', text:`+${result.moodGained} 心情`},
    ];
    if (levelUp) rewards.push({emoji:newLvl.emoji, text:`升到 Lv.${newLvl.level}`});
    newBadges.forEach(b => rewards.push({emoji:b.icon, text:`解锁「${b.name}」`}));

    $('celebrateIcon').textContent = levelUp ? '🎊' : '🎉';
    $('celebrateTitle').textContent = levelUp ? '升级了！' : '太棒了！';
    $('celebrateMsg').textContent = `你完成了「${task.title}」`;
    $('celebrateRewards').innerHTML = rewards.map(r =>
      `<div class="reward"><div class="reward-emoji">${r.emoji}</div><div class="reward-text">${r.text}</div></div>`
    ).join('');
    openOverlay('celebrateModal');

    renderPet(); renderBadges(); renderStats(); renderHistory();
  }

  // ===== 5分钟倒计时（锁屏不暂停 + 完成通知） =====
  let timerMeta = null; // { startTs, totalSec, step, quotes, circ, circle, text, hint, quote }
  let audioCtx = null; // 在用户交互时初始化，避免浏览器阻止自动播放

  function requestNotifyPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
    // 在用户交互时初始化 AudioContext（浏览器要求）
    if (!audioCtx) {
      try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch {}
    }
  }

  function notifyTimerDone() {
    // 震动
    try { if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 200]); } catch {}
    // 系统通知
    try {
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('🎉 5分钟到了！', {
          body: '太棒了！你已经迈出了最难的一步',
          icon: 'icons/icon-192.png',
          tag: 'timer-done',
          requireInteraction: true
        });
      }
    } catch {}
    // 音效（使用预初始化的 audioCtx）
    try {
      if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
      if (audioCtx) {
        const osc = audioCtx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, audioCtx.currentTime);
        osc.connect(audioCtx.destination);
        osc.start(); osc.stop(audioCtx.currentTime + 0.5);
      }
    } catch {}
  }

  function tickTimer() {
    if (!timerMeta) return;
    const { startTs, totalSec, step, quotes, circ, circle, text, hint, quote } = timerMeta;
    const elapsed = Math.floor((Date.now() - startTs) / 1000);
    const sec = Math.max(0, totalSec - elapsed);

    text.textContent = `${Math.floor(sec/60)}:${String(sec%60).padStart(2,'0')}`;
    circle.style.strokeDashoffset = circ * (1 - sec / totalSec);
    if (sec > 0 && sec % 60 === 0) quote.textContent = quotes[Math.floor(Math.random()*quotes.length)];

    if (sec <= 0) {
      clearInterval(timerInterval); timerInterval = null;
      text.textContent = '🎉';
      hint.textContent = '太棒了！5分钟到了！';
      quote.textContent = '"你已经迈出了最难的一步"';
      $('btnTimerContinue').style.display = '';
      $('btnTimerCancel').textContent = '关闭';
      // 不自动标记完成，让用户自己勾选
      notifyTimerDone();
      timerMeta = null;
    }
  }

  function startTimer() {
    const task = currentTask();
    if (!task) return;
    const step = task.steps.find(s=>!s.done);
    if (!step) return;

    // 请求通知权限
    requestNotifyPermission();

    openOverlay('timerModal');
    const circ = 2*Math.PI*90;
    const circle = $('timerCircle');
    const text = $('timerText');
    const hint = $('timerHint');
    const quote = $('timerQuote');
    const quotes = ['"先做5分钟，你就赢了"','"不用完美，先动起来"','"每一步都算数"','"最难的是开始，你已经在做了"'];

    circle.style.strokeDasharray = circ;
    circle.style.strokeDashoffset = 0;
    text.textContent = '5:00';
    hint.textContent = step.text;
    quote.textContent = quotes[0];
    $('btnTimerContinue').style.display = 'none';
    $('btnTimerCancel').textContent = '放弃';

    timerMeta = { startTs: Date.now(), totalSec: 300, step, quotes, circ, circle, text, hint, quote };
    timerInterval = setInterval(tickTimer, 1000);
  }

  function cancelTimer() {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
    timerMeta = null;
    closeOverlay('timerModal');
  }
  function continueTimer() {
    closeOverlay('timerModal');
    const task = currentTask();
    if (task && task.steps.every(s=>s.done)) completeTask(task);
  }

  // 页面重新可见时，立即刷新倒计时（解决锁屏暂停问题）
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && timerMeta) tickTimer();
  });

  // ===== 编辑步骤 =====
  function openEdit() {
    const task = currentTask();
    if (!task) return;
    const container = $('editSteps');
    container.innerHTML = '';
    task.steps.forEach(s => container.appendChild(editRow(s.text)));
    openOverlay('editModal');
  }
  function editRow(text='') {
    const div = document.createElement('div');
    div.className = 'edit-row';
    div.innerHTML = `<input type="text" value="${esc(text)}" placeholder="步骤描述"/><button class="edit-del" onclick="this.parentElement.remove()">×</button>`;
    return div;
  }
  function addEditRow() { $('editSteps').appendChild(editRow()); }
  function saveEdit() {
    const task = currentTask();
    if (!task) return;
    const inputs = $('editSteps').querySelectorAll('input');
    const oldMap = {}; task.steps.forEach(s=>{ oldMap[s.text]=s.done; });
    task.steps = Array.from(inputs).map((inp,i) => ({
      id:i+1, text:inp.value.trim(), done:oldMap[inp.value.trim()]||false, difficulty:task.difficulty
    })).filter(s=>s.text);
    save(); closeOverlay('editModal'); renderTask();
  }

  // ===== 渲染 =====
  function renderAll() { renderPet(); renderTask(); renderHistory(); renderBadges(); renderStats(); }

  function renderPet() {
    const p = state.pet, lv = PetSystem.getLevel(p.growth), next = PetSystem.getNextLevel(p.growth), pct = PetSystem.getGrowthProgress(p.growth);
    $('petFace').textContent = PetSystem.getFace(p.mood);
    $('petLevel').textContent = `Lv.${lv.level}`;
    $('moodBar').style.width = `${p.mood}%`;
    $('moodValue').textContent = p.mood;
    $('growthBar').style.width = `${pct}%`;
    $('growthValue').textContent = next ? `${p.growth}/${next.need}` : 'MAX';
    setSpeech(PetSystem.getSpeech(p.mood));
  }

  function setSpeech(text) { $('petSpeech').textContent = text; }

  function renderTask() {
    const task = currentTask();
    const sec = $('taskSection');
    if (!task) { sec.style.display='none'; setSpeech(PetSystem.getSpeech(state.pet.mood,'idle')); return; }
    sec.style.display = '';

    $('currentTaskTitle').textContent = task.title;

    const done = task.steps.filter(s=>s.done).length, total = task.steps.length, pct = total?Math.round(done/total*100):0;
    const ring = $('progressRing');
    const circ = 2*Math.PI*15.9;
    ring.style.strokeDasharray = circ;
    ring.style.strokeDashoffset = circ*(1-pct/100);
    $('progressPct').textContent = `${pct}%`;

    const list = $('stepsList');
    list.innerHTML = '';
    task.steps.forEach(step => {
      const div = document.createElement('div');
      div.className = `step${step.done?' done':''}`;
      div.innerHTML = `<div class="step-dot">${step.done?'✓':''}</div><span class="step-text">${esc(step.text)}</span><span class="step-tag ${step.difficulty}">${diffLabel(step.difficulty)}</span>`;
      div.addEventListener('click', () => toggleStep(step.id));
      list.appendChild(div);
    });

    const next = task.steps.find(s=>!s.done);
    if (next) setSpeech(`下一步：${next.text}`);
    else setSpeech('全部完成了！你太棒了！🎉');
  }

  function renderHistory() {
    const list = $('historyList');
    const tasks = state.tasks.filter(t=>t.id!==state.currentTaskId);
    if (!tasks.length) { list.innerHTML = '<div class="empty-hint">还没有任务，快来试试吧~</div>'; return; }
    list.innerHTML = tasks.slice(0,10).map(t => {
      const done=t.steps.filter(s=>s.done).length, total=t.steps.length, complete=!!t.completedAt;
      return `<div class="history-item" onclick="App.loadTask('${t.id}')"><span class="history-title">${esc(t.title)}</span><span class="history-badge ${complete?'done':'doing'}">${complete?'✅ 已完成':`${done}/${total}`}</span></div>`;
    }).join('');
  }

  function renderBadges() {
    $('badgesGrid').innerHTML = BADGES.map(b => {
      const u = state.badges.includes(b.id);
      return `<div class="badge ${u?'unlocked':'locked'}" title="${b.name}"><div class="badge-icon">${b.icon}</div><div class="badge-name">${b.name}</div></div>`;
    }).join('');
  }

  function renderStats() {
    $('statTotal').textContent = state.stats.totalCompleted;
    $('statStreak').textContent = state.stats.streak;
    $('statToday').textContent = state.stats.todayCompleted;
  }

  // ===== 弹窗 =====
  function openOverlay(id) { $(id).classList.add('open'); }
  function closeOverlay(id) { $(id).classList.remove('open'); }

  // ===== 切换任务 =====
  function loadTask(id) {
    state.currentTaskId = id; save();
    renderTask(); renderHistory();
    window.scrollTo({top:0,behavior:'smooth'});
  }

  // ===== 辅助 =====
  function currentTask() { return state.tasks.find(t=>t.id===state.currentTaskId)||null; }
  function esc(s) { const d=document.createElement('div'); d.textContent=s; return d.innerHTML; }

  document.addEventListener('DOMContentLoaded', init);
  return { toggleStep, loadTask };
})();
