const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const TILE = 16;
const MAP_SIZE = 24;

function byId(id) { return document.getElementById(id); }

const MAP_FACTORY = {
  town: { name: '平安镇', palette: ['#2e7d32', '#5d4037', '#9e9e9e', '#1976d2', '#ffb300'], builder: buildTown },
  wild: { name: '黑风岭', palette: ['#33691e', '#4e342e', '#8d6e63', '#1565c0', '#ef6c00'], builder: buildWild },
  shaolin: { name: '少林寺', palette: ['#558b2f', '#6d4c41', '#a1887f', '#1976d2', '#ffca28'], builder: buildTemple },
  wudang: { name: '武当山', palette: ['#689f38', '#5d4037', '#bcaaa4', '#1e88e5', '#ffd54f'], builder: buildTemple },
  inn: { name: '悦来客栈', palette: ['#8bc34a', '#6d4c41', '#8d6e63', '#039be5', '#ffca28'], builder: buildInn },
  market: { name: '黑市', palette: ['#558b2f', '#4e342e', '#6d4c41', '#0277bd', '#ff8f00'], builder: buildInn },
};

const maps = makeMaps();

function makeMaps() {
  return {
    town: {
      ...MAP_FACTORY.town,
      tiles: MAP_FACTORY.town.builder(),
      npcs: [
        npc('shop', 5, 6, '王掌柜', ['小店货真价实。']),
        npc('trainer', 18, 6, '武馆师父', ['一天不练，自己知道。']),
        npc('quest', 12, 11, '里正', ['镇外不太平，望少侠相助。']),
        npc('faction', 20, 20, '行脚僧', ['入少林，去东门。'], { faction: '少林' }),
        npc('faction', 3, 20, '道长', ['入武当，去西门。'], { faction: '武当' }),
        npc('smith', 7, 16, '铁匠', ['有钱就能强化装备。']),
        npc('gamble', 15, 16, '赌徒', ['押大小，一夜暴富。']),
      ],
      enemies: [enemy('thug1', 14, 14, '地痞', 28, 7, 2, 12, 12), enemy('thug2', 16, 14, '无赖', 30, 8, 2, 13, 13)],
      transitions: [
        gate(12, 0, 'wild', 12, 22), gate(0, 12, 'wudang', 22, 12), gate(23, 12, 'shaolin', 1, 12),
        gate(12, 23, 'inn', 12, 1), gate(23, 23, 'market', 1, 1),
      ],
    },
    wild: {
      ...MAP_FACTORY.wild,
      tiles: MAP_FACTORY.wild.builder(),
      npcs: [npc('secret', 6, 6, '神秘老人', ['你骨骼惊奇。'])],
      enemies: [
        enemy('bandit1', 10, 8, '山贼', 36, 9, 3, 20, 18),
        enemy('bandit2', 13, 8, '山贼', 36, 9, 3, 20, 18),
        enemy('boss', 12, 4, '山贼头目', 70, 13, 5, 100, 90, true),
      ],
      transitions: [gate(12, 23, 'town', 12, 1)],
    },
    shaolin: {
      ...MAP_FACTORY.shaolin,
      tiles: MAP_FACTORY.shaolin.builder(),
      npcs: [npc('skill', 12, 9, '玄慈方丈', ['少林讲究慈悲为怀。'], { skill: '罗汉拳' })],
      enemies: [],
      transitions: [gate(0, 12, 'town', 22, 12)],
    },
    wudang: {
      ...MAP_FACTORY.wudang,
      tiles: MAP_FACTORY.wudang.builder(),
      npcs: [npc('skill', 12, 9, '冲虚道长', ['太极之道，刚柔并济。'], { skill: '太极剑法' })],
      enemies: [],
      transitions: [gate(23, 12, 'town', 1, 12)],
    },
    inn: {
      ...MAP_FACTORY.inn,
      tiles: MAP_FACTORY.inn.builder(),
      npcs: [npc('rest', 12, 12, '店小二', ['住店一晚恢复状态。'])],
      enemies: [],
      transitions: [gate(12, 0, 'town', 12, 22)],
    },
    market: {
      ...MAP_FACTORY.market,
      tiles: MAP_FACTORY.market.builder(),
      npcs: [npc('blackmarket', 12, 12, '黑市商人', ['这里什么都买得到。'])],
      enemies: [],
      transitions: [gate(0, 0, 'town', 22, 22)],
    },
  };
}

function npc(type, x, y, name, lines, extra = {}) { return { type, x, y, name, lines, ...extra }; }
function enemy(id, x, y, name, hp, atk, def, exp, gold, boss = false) { return { id, x, y, name, hp, atk, def, exp, gold, boss }; }
function gate(x, y, toMap, toX, toY) { return { x, y, toMap, toX, toY }; }

const game = {
  mapId: 'town',
  battle: null,
  dialogQueue: [],
  player: {
    name: '无名侠客', x: 12, y: 12,
    level: 1, exp: 0, nextExp: 30,
    faction: '无门派', hp: 60, maxHp: 60, mp: 24, maxMp: 24,
    atk: 9, def: 4, gold: 80,
    ethics: 50, reputation: 0, spouse: null,
    equip: { weapon: '木剑', armor: '布衣', weaponAtk: 2, armorDef: 1 },
    bag: [
      { key: 'heal', name: '金创药', qty: 4, heal: 22, price: 12 },
      { key: 'mp', name: '养气丹', qty: 2, mp: 14, price: 16 },
      { key: 'revive', name: '还魂丹', qty: 1, heal: 50, price: 80 },
    ],
    skills: [{ name: '基础拳法', ratio: 1.2, mpCost: 0 }],
    quests: [
      { id: 'q_bandit', title: '剿灭黑风岭', status: 'ongoing', target: '击败山贼头目', reward: '银两90/经验100/声望10' },
      { id: 'q_join', title: '拜入门派', status: 'ongoing', target: '加入任意门派', reward: '最大HP+10' },
      { id: 'q_marriage', title: '江湖眷侣', status: 'locked', target: '声望达到20后触发', reward: '气血恢复加成' },
    ],
    flags: { secretMet: false, married: false },
  },
};

const ui = {
  location: byId('location'), faction: byId('faction'), level: byId('level'), hp: byId('hp'), maxHp: byId('maxHp'),
  mp: byId('mp'), maxMp: byId('maxMp'), gold: byId('gold'), message: byId('messageText'),
  dialog: byId('dialog'), dialogTitle: byId('dialogTitle'), dialogText: byId('dialogText'), dialogBtn: byId('dialogBtn'), dialogCancelBtn: byId('dialogCancelBtn'),
  battlePanel: byId('battlePanel'), enemyInfo: byId('enemyInfo'), battleLog: byId('battleLog'),
  attackBtn: byId('attackBtn'), skillBtn: byId('skillBtn'), itemBtn: byId('itemBtn'), fleeBtn: byId('fleeBtn'),
  sidePanel: byId('sidePanel'), sideTitle: byId('sidePanelTitle'), sideContent: byId('sidePanelContent'), sideClose: byId('sidePanelClose'),
};

function buildTown() {
  return gen((x, y) => {
    const border = borderWithGates(x, y, [[12, 0], [0, 12], [23, 12], [12, 23], [23, 23]]);
    if (border !== null) return border;
    if (x > 8 && x < 16 && y > 7 && y < 17) return 2;
    if ((x > 2 && x < 8 && y > 3 && y < 8) || (x > 16 && x < 22 && y > 3 && y < 8)) return 1;
    return 0;
  });
}
function buildWild() {
  return gen((x, y) => {
    const border = borderWithGates(x, y, [[12, 23]]);
    if (border !== null) return border;
    if ((x > 8 && x < 16 && y > 2 && y < 11) || (x > 10 && x < 14 && y > 11 && y < 20)) return 2;
    if ((x === 6 || x === 18) && y > 5 && y < 19) return 1;
    return 0;
  });
}
function buildTemple() {
  return gen((x, y) => {
    const border = borderWithGates(x, y, [[0, 12], [23, 12]]);
    if (border !== null) return border;
    if (x > 7 && x < 17 && y > 5 && y < 18) return 2;
    return 0;
  });
}
function buildInn() {
  return gen((x, y) => {
    const border = borderWithGates(x, y, [[12, 0], [0, 0]]);
    if (border !== null) return border;
    if (x > 5 && x < 19 && y > 5 && y < 19) return 2;
    return 0;
  });
}
function borderWithGates(x, y, gates) {
  if (x !== 0 && y !== 0 && x !== 23 && y !== 23) return null;
  return gates.some(([gx, gy]) => gx === x && gy === y) ? 4 : 1;
}
function gen(cb) { return Array.from({ length: MAP_SIZE }, (_, y) => Array.from({ length: MAP_SIZE }, (_, x) => cb(x, y) ?? 0)); }

function currentMap() { return maps[game.mapId]; }

function draw() {
  const map = currentMap();
  const [grass, wall, road, water, gateColor] = map.palette;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (let y = 0; y < MAP_SIZE; y++) {
    for (let x = 0; x < MAP_SIZE; x++) {
      const t = map.tiles[y][x];
      ctx.fillStyle = [grass, wall, road, water, gateColor][t] || grass;
      ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
    }
  }
  map.npcs.forEach((n) => blit(n.x, n.y, '#fdd835'));
  map.enemies.forEach((e) => blit(e.x, e.y, e.boss ? '#d50000' : '#c62828'));
  blit(game.player.x, game.player.y, '#42a5f5');
}
function blit(x, y, color) { ctx.fillStyle = color; ctx.fillRect(x * TILE + 2, y * TILE + 2, 12, 12); }

function canWalk(x, y) { return x >= 0 && y >= 0 && x < MAP_SIZE && y < MAP_SIZE && currentMap().tiles[y][x] !== 1; }

function move(dir) {
  if (game.battle) return;
  const d = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[dir];
  const nx = game.player.x + d[0], ny = game.player.y + d[1];
  if (!canWalk(nx, ny)) return;
  game.player.x = nx; game.player.y = ny;
  handleTransition();
  encounter();
  draw(); syncHud();
}

function handleTransition() {
  const t = currentMap().transitions.find((it) => it.x === game.player.x && it.y === game.player.y);
  if (!t) return;
  game.mapId = t.toMap;
  game.player.x = t.toX; game.player.y = t.toY;
  msg(`进入 ${currentMap().name}`);
}

function near(ent) { return Math.abs(ent.x - game.player.x) + Math.abs(ent.y - game.player.y) === 1; }

function interact() {
  const npc = currentMap().npcs.find(near);
  if (!npc) return msg('周围无人可交互。');
  const acts = {
    shop: shop, trainer: trainer, faction: faction, quest: questNpc, skill: skillNpc,
    rest: innRest, gamble: gamble, smith: smith, blackmarket: blackMarket, secret: secretEvent,
  };
  (acts[npc.type] || (() => dialog(npc.name, npc.lines)))(npc);
}

function questNpc(n) {
  const lines = [...n.lines, questDigest()];
  if (findQuest('q_bandit')?.status === 'done') lines.push('你已平定黑风岭，镇民感激涕零。');
  dialog(n.name, lines);
}

function questDigest() {
  return game.player.quests.map((q) => `${q.title}：${q.status}`).join(' / ');
}

function shop(n) {
  if (game.player.gold >= 12) {
    game.player.gold -= 12; addBag('heal', '金创药', { heal: 22, price: 12 });
    dialog(n.name, ['购买成功：金创药 x1。']);
  } else dialog(n.name, ['银两不足。']);
  syncHud();
}

function trainer(n) {
  if (game.player.gold < 25) return dialog(n.name, ['训练一次需 25 两。']);
  game.player.gold -= 25; game.player.atk += 1; game.player.def += 1; game.player.reputation += 1;
  dialog(n.name, ['刻苦训练后，攻击+1，防御+1，声望+1。']);
  syncHud();
}

function smith(n) {
  const cost = 35;
  if (game.player.gold < cost) return dialog(n.name, ['强化需 35 两。']);
  game.player.gold -= cost;
  game.player.equip.weaponAtk += 1;
  game.player.equip.armorDef += 1;
  dialog(n.name, ['装备强化成功：武器+1，护甲+1。']);
  syncHud();
}

function gamble(n) {
  const bet = 20;
  if (game.player.gold < bet) return dialog(n.name, ['下注至少 20 两。']);
  game.player.gold -= bet;
  const win = Math.random() > 0.45;
  if (win) { game.player.gold += 45; game.player.ethics = Math.max(0, game.player.ethics - 1); dialog(n.name, ['你赌赢了，净赚 25 两。']); }
  else dialog(n.name, ['你赌输了。']);
  syncHud();
}

function blackMarket(n) {
  if (game.player.gold < 80) return dialog(n.name, ['黑市绝学售价 80 两。']);
  game.player.gold -= 80;
  if (!game.player.skills.some((s) => s.name === '辟邪剑法')) game.player.skills.push({ name: '辟邪剑法', ratio: 2.4, mpCost: 10 });
  game.player.ethics = Math.max(0, game.player.ethics - 6);
  dialog(n.name, ['你学会了辟邪剑法，但侠义值下降。']);
  syncHud();
}

function innRest(n) {
  if (game.player.gold < 10) return dialog(n.name, ['住店一晚 10 两。']);
  game.player.gold -= 10;
  game.player.hp = game.player.maxHp;
  game.player.mp = game.player.maxMp;
  dialog(n.name, ['你睡了个好觉，状态恢复。']);
  syncHud();
}

function faction(n) {
  if (game.player.faction !== '无门派') return dialog(n.name, [`你已加入 ${game.player.faction}。`]);
  game.player.faction = n.faction;
  game.player.maxHp += 10; game.player.hp = game.player.maxHp;
  doneQuest('q_join');
  dialog(n.name, [`你加入了 ${n.faction}，最大气血 +10。`]);
  syncHud();
}

function skillNpc(n) {
  if (game.player.faction === '无门派') return dialog(n.name, ['先入门派，再学绝学。']);
  if (game.player.skills.some((s) => s.name === n.skill)) return dialog(n.name, ['你已习得此技。']);
  game.player.skills.push({ name: n.skill, ratio: 2.1, mpCost: 6 });
  dialog(n.name, [`你学会了 ${n.skill}。`]);
}

function secretEvent(n) {
  if (game.player.flags.secretMet) return dialog(n.name, ['后会有期。']);
  game.player.flags.secretMet = true;
  game.player.reputation += 5;
  addBag('revive', '还魂丹', { heal: 50, price: 80 });
  dialog(n.name, ['神秘老人赠你还魂丹并提升声望。']);
  tryUnlockMarriage();
}

function encounter() {
  const e = currentMap().enemies.find((it) => it.x === game.player.x && it.y === game.player.y);
  if (!e) return;
  game.battle = { enemy: { ...e }, ref: e.id };
  ui.battlePanel.classList.remove('hidden');
  battleMsg(`${e.name} 挡住去路！`);
}

function damage(base, def) { return Math.max(1, Math.floor(base - def / 2 + Math.random() * 5)); }
function battleMsg(text) { ui.enemyInfo.textContent = `${game.battle.enemy.name} HP ${game.battle.enemy.hp}`; ui.battleLog.textContent = text; }

function playerAttack(useSkill) {
  if (!game.battle) return;
  const skill = useSkill ? game.player.skills[game.player.skills.length - 1] : null;
  if (skill && game.player.mp < skill.mpCost) return battleMsg('内力不足。');
  if (skill) game.player.mp -= skill.mpCost;
  const base = game.player.atk + game.player.equip.weaponAtk;
  const d = damage(base * (skill ? skill.ratio : 1), game.battle.enemy.def);
  game.battle.enemy.hp = Math.max(0, game.battle.enemy.hp - d);
  battleMsg(`你${skill ? `施展${skill.name}` : '普攻'}造成 ${d} 伤害。`);
  if (game.battle.enemy.hp <= 0) return winBattle();
  enemyTurn(); syncHud();
}

function useItem() {
  if (!game.battle) return;
  const item = game.player.bag.find((it) => it.key === 'heal' && it.qty > 0);
  if (!item) return battleMsg('没有金创药。');
  item.qty -= 1;
  game.player.hp = Math.min(game.player.maxHp, game.player.hp + item.heal);
  battleMsg('你服下金创药，恢复气血。');
  enemyTurn(); syncHud();
}

function enemyTurn() {
  if (!game.battle) return;
  const d = damage(game.battle.enemy.atk, game.player.def + game.player.equip.armorDef);
  game.player.hp = Math.max(0, game.player.hp - d);
  battleMsg(`${game.battle.enemy.name} 反击造成 ${d} 伤害。`);
  if (game.player.hp <= 0) {
    const rev = game.player.bag.find((it) => it.key === 'revive' && it.qty > 0);
    if (rev) {
      rev.qty -= 1;
      game.player.hp = Math.floor(game.player.maxHp * 0.5);
      battleMsg('还魂丹生效，你重返战场！');
      return;
    }
    game.player.x = 12; game.player.y = 12; game.mapId = 'town';
    game.player.hp = game.player.maxHp; game.player.mp = game.player.maxMp;
    msg('你战败回城。');
    endBattle();
  }
}

function winBattle() {
  const e = game.battle.enemy;
  game.player.exp += e.exp; game.player.gold += e.gold; game.player.reputation += 2;
  currentMap().enemies = currentMap().enemies.filter((it) => it.id !== game.battle.ref);
  if (e.boss) doneQuest('q_bandit');
  msg(`战胜 ${e.name}！经验+${e.exp} 银两+${e.gold} 声望+2`);
  levelUp();
  tryUnlockMarriage();
  endBattle();
  syncHud();
}

function endBattle() { setTimeout(() => { game.battle = null; ui.battlePanel.classList.add('hidden'); draw(); syncHud(); }, 400); }

function levelUp() {
  while (game.player.exp >= game.player.nextExp) {
    game.player.exp -= game.player.nextExp;
    game.player.level += 1;
    game.player.nextExp = Math.floor(game.player.nextExp * 1.5);
    game.player.maxHp += 12; game.player.maxMp += 5; game.player.atk += 2; game.player.def += 1;
    game.player.hp = game.player.maxHp; game.player.mp = game.player.maxMp;
    msg(`升级至 ${game.player.level} 级！`);
  }
}

function rest() {
  game.player.hp = game.player.maxHp; game.player.mp = game.player.maxMp;
  if (game.player.flags.married) game.player.hp = Math.min(game.player.maxHp, game.player.hp + 5);
  msg('打坐完成，状态恢复。');
  syncHud();
}

function addBag(key, name, extra) {
  const it = game.player.bag.find((i) => i.key === key);
  if (it) it.qty += 1; else game.player.bag.push({ key, name, qty: 1, ...extra });
}

function findQuest(id) { return game.player.quests.find((q) => q.id === id); }
function doneQuest(id) {
  const q = findQuest(id);
  if (!q || q.status === 'done') return;
  q.status = 'done';
  if (id === 'q_bandit') { game.player.gold += 90; game.player.exp += 100; game.player.reputation += 10; }
}

function tryUnlockMarriage() {
  const q = findQuest('q_marriage');
  if (!q) return;
  if (game.player.reputation >= 20 && q.status === 'locked') q.status = 'ongoing';
  if (q.status === 'ongoing' && !game.player.flags.married) {
    game.player.flags.married = true;
    game.player.spouse = '小昭';
    q.status = 'done';
    msg('你与小昭喜结连理，今后打坐额外恢复。');
  }
}

function openInventory() {
  const txt = [
    `姓名：${game.player.name}`,
    `等级：${game.player.level} (${game.player.exp}/${game.player.nextExp})`,
    `门派：${game.player.faction}`,
    `攻击：${game.player.atk}+${game.player.equip.weaponAtk}`,
    `防御：${game.player.def}+${game.player.equip.armorDef}`,
    `侠义：${game.player.ethics}  声望：${game.player.reputation}`,
    `伴侣：${game.player.spouse || '无'}`,
    `武器：${game.player.equip.weapon}  护甲：${game.player.equip.armor}`,
    '—— 物品 ——',
    ...game.player.bag.map((b) => `${b.name} x${b.qty}`),
    '—— 武学 ——',
    ...game.player.skills.map((s) => `${s.name} (耗内${s.mpCost})`),
  ].join('\n');
  side('人物面板', txt);
}

function openQuests() {
  const txt = game.player.quests.map((q) => `${q.title}\n状态：${q.status}\n目标：${q.target}\n奖励：${q.reward}`).join('\n\n');
  side('任务日志', txt || '暂无任务');
}

function side(title, txt) {
  ui.sideTitle.textContent = title;
  ui.sideContent.textContent = txt;
  ui.sidePanel.classList.remove('hidden');
}

function save() {
  localStorage.setItem('hero_story_full_save_v3', JSON.stringify(game));
  msg('存档成功。');
}
function load() {
  const raw = localStorage.getItem('hero_story_full_save_v3');
  if (!raw) return msg('暂无存档。');
  const data = JSON.parse(raw);
  game.mapId = data.mapId;
  Object.assign(game.player, data.player);
  game.battle = null; game.dialogQueue = [];
  msg('读档成功。');
  syncHud(); draw();
}

function dialog(title, lines) {
  game.dialogQueue = [...lines];
  ui.dialogTitle.textContent = title;
  ui.dialogText.textContent = game.dialogQueue.shift() || '';
  ui.dialog.classList.remove('hidden');
}
function dialogNext() {
  if (!game.dialogQueue.length) return ui.dialog.classList.add('hidden');
  ui.dialogText.textContent = game.dialogQueue.shift();
}

function syncHud() {
  ui.location.textContent = currentMap().name;
  ui.faction.textContent = game.player.faction;
  ui.level.textContent = String(game.player.level);
  ui.hp.textContent = String(game.player.hp);
  ui.maxHp.textContent = String(game.player.maxHp);
  ui.mp.textContent = String(game.player.mp);
  ui.maxMp.textContent = String(game.player.maxMp);
  ui.gold.textContent = String(game.player.gold);
}
function msg(t) { ui.message.textContent = `${t}｜声望:${game.player.reputation} 侠义:${game.player.ethics}`; }

function wire() {
  document.querySelectorAll('.dpad button').forEach((b) => b.addEventListener('click', () => move(b.dataset.dir)));
  byId('interactBtn').addEventListener('click', interact);
  byId('restBtn').addEventListener('click', rest);
  byId('inventoryBtn').addEventListener('click', openInventory);
  byId('questBtn').addEventListener('click', openQuests);
  byId('saveBtn').addEventListener('click', save);
  byId('loadBtn').addEventListener('click', load);
  ui.dialogBtn.addEventListener('click', dialogNext);
  ui.dialogCancelBtn.addEventListener('click', () => ui.dialog.classList.add('hidden'));
  ui.attackBtn.addEventListener('click', () => playerAttack(false));
  ui.skillBtn.addEventListener('click', () => playerAttack(true));
  ui.itemBtn.addEventListener('click', useItem);
  ui.fleeBtn.addEventListener('click', () => {
    game.player.x = 12; game.player.y = 12; game.mapId = 'town';
    msg('你脱战回城。');
    endBattle();
  });
  ui.sideClose.addEventListener('click', () => ui.sidePanel.classList.add('hidden'));
  window.addEventListener('keydown', (e) => {
    const map = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
    if (map[e.key]) move(map[e.key]);
    if (e.key === ' ') interact();
  });
}

wire();
syncHud();
draw();
dialog('开场', [
  '已升级为“全量内容复刻框架”：主线、门派、黑市、赌坊、强化、婚配、存档均可玩。',
  '建议路线：接里正任务 -> 黑风岭击败头目 -> 加入门派 -> 学绝学。',
]);
