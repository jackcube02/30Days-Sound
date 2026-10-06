'use strict';
const $ = (selector) => document.querySelector(selector);
const audio = $('#audio');
const people = window.ARCHIVE_DATA.people;
const records = new Map();
let active = null;
let loadingToken = 0;
let noticeTimer;
const formatTime = (seconds) => `${Math.floor((seconds || 0) / 60)}:${String(Math.floor((seconds || 0) % 60)).padStart(2, '0')}`;
const pad = (number) => String(number).padStart(2, '0');
const escapeHTML = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
function notice(message) {
  $('#status').textContent = message;
  $('#status').hidden = false;
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => { $('#status').hidden = true; }, 5000);
}
function wave(seed) {
  return Array.from({ length: 34 }, (_, i) => {
    const height = 3 + Math.abs(Math.sin(seed * 3.7 + i * 1.9) * Math.cos(i * .42 + seed)) * 21;
    return `<i style="height:${height.toFixed(1)}px;--i:${i}"></i>`;
  }).join('');
}
const archive = $('#archive');
archive.innerHTML = `<div role="row" class="person-row">${people.map((person, index) => `<div role="columnheader" class="person-heading"><div class="person-top"><span>RECORDIST ${pad(index + 1)}</span><span>30 FILES</span></div><h3 class="person-name">${escapeHTML(person.name)}</h3><span class="person-caption">30일간의 소리 수집</span></div>`).join('')}</div>`;
for (let day = 1; day <= 30; day++) {
  const row = document.createElement('div');
  row.className = 'day-row';
  row.id = `day-${day}`;
  row.setAttribute('role', 'row');
  people.forEach((person, index) => {
    const key = `${index + 1}-${day}`;
    const override = window.ARCHIVE_DATA.overrides[key];
    const record = { key, person: index, day, title: person.sound, context: '합성 앰비언트 · 데모 사운드', src: `data/demo/${person.file}`, duration: '0:12', demo: true, ...override };
    if (override) record.demo = false;
    const cell = document.createElement('article');
    cell.className = 'record';
    cell.dataset.key = key;
    cell.setAttribute('role', 'cell');
    cell.innerHTML = `<div class="record-top"><span class="day-number">DAY ${pad(day)}</span><span class="sample-label">${record.demo ? 'SAMPLE' : 'AUDIO'}</span></div><h4 class="record-title">${escapeHTML(record.title)}</h4><p class="record-context">${escapeHTML(record.context)}</p><div class="record-bottom"><button class="record-play" type="button" aria-label="${person.name} ${day}일차 재생" aria-pressed="false"><span class="play-shape"></span></button><div class="waveform" aria-hidden="true">${wave(index * 30 + day)}</div><span class="record-time">${escapeHTML(record.duration)}</span></div>`;
    record.element = cell;
    records.set(key, record);
    cell.querySelector('button').addEventListener('click', () => playRecord(record));
    row.appendChild(cell);
  });
  archive.appendChild(row);
  $('#day-jump').add(new Option(`DAY ${pad(day)}`, String(day)));
  $('#connect-day').add(new Option(`${day}일차`, String(day)));
}
people.forEach((person, index) => $('#connect-person').add(new Option(person.name, String(index + 1))));
function renderState() {
  const playing = active && !audio.paused;
  document.querySelectorAll('.record.selected, .record.playing').forEach((cell) => {
    cell.classList.remove('selected', 'playing');
    const record = records.get(cell.dataset.key);
    const button = cell.querySelector('button');
    button.innerHTML = '<span class="play-shape"></span>';
    button.setAttribute('aria-pressed', 'false');
    button.setAttribute('aria-label', `${people[record.person].name} ${record.day}일차 재생`);
  });
  if (active) {
    active.element.classList.add('selected');
    active.element.classList.toggle('playing', Boolean(playing));
    const button = active.element.querySelector('button');
    button.innerHTML = `<span class="${playing ? 'pause' : 'play'}-shape"></span>`;
    button.setAttribute('aria-pressed', String(Boolean(playing)));
    button.setAttribute('aria-label', `${people[active.person].name} ${active.day}일차 ${playing ? '일시정지' : '재생'}`);
    $('#player-title').textContent = active.title;
    $('#player-subtitle').textContent = `${people[active.person].name} / DAY ${pad(active.day)}${active.demo ? ' / 데모 사운드' : ''}`;
    $('#main-play').disabled = false;
    $('#previous').disabled = active.day === 1;
    $('#next').disabled = active.day === 30;
  }
  $('#main-play').innerHTML = `<span class="${playing ? 'pause' : 'play'}-shape"></span>`;
  $('#main-play').setAttribute('aria-label', playing ? '일시정지' : '재생');
}
async function playRecord(record) {
  const token = ++loadingToken;
  if (active === record && !audio.paused) { audio.pause(); return; }
  if (active !== record) {
    audio.pause();
    active = record;
    audio.src = record.src;
    $('#seek').value = 0;
    $('#seek').disabled = true;
    $('#elapsed').textContent = '0:00';
    $('#duration').textContent = record.duration || '0:00';
  }
  renderState();
  try { await audio.play(); }
  catch (error) {
    if (token === loadingToken && error.name !== 'AbortError') notice('오디오를 재생할 수 없습니다. 파일 경로 또는 지원 형식을 확인해주세요.');
  }
  if (token === loadingToken) renderState();
}
audio.volume = .7;
['play', 'pause', 'ended'].forEach((event) => audio.addEventListener(event, renderState));
audio.addEventListener('loadedmetadata', () => {
  if (!active || !Number.isFinite(audio.duration)) return;
  active.duration = formatTime(audio.duration);
  active.element.querySelector('.record-time').textContent = active.duration;
  $('#duration').textContent = active.duration;
  $('#seek').disabled = false;
});
audio.addEventListener('timeupdate', () => {
  $('#elapsed').textContent = formatTime(audio.currentTime);
  $('#seek').value = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.currentTime / audio.duration * 100 : 0;
});
audio.addEventListener('error', () => { $('#seek').disabled = true; renderState(); });
$('#main-play').addEventListener('click', () => { if (active) playRecord(active); });
$('#previous').addEventListener('click', () => { if (active && active.day > 1) playRecord(records.get(`${active.person + 1}-${active.day - 1}`)); });
$('#next').addEventListener('click', () => { if (active && active.day < 30) playRecord(records.get(`${active.person + 1}-${active.day + 1}`)); });
$('#seek').addEventListener('input', (event) => { if (Number.isFinite(audio.duration)) audio.currentTime = Number(event.target.value) / 100 * audio.duration; });
$('#volume').addEventListener('input', (event) => { audio.volume = Number(event.target.value); });
$('#day-jump').addEventListener('change', (event) => { $(`#day-${event.target.value}`).scrollIntoView({ block: 'start' }); });
$('#connect-open').addEventListener('click', () => $('#connect-dialog').showModal());
$('#connect-close').addEventListener('click', () => $('#connect-dialog').close());
$('#connect-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const file = $('#connect-file').files[0];
  if (!file) return;
  const record = records.get(`${$('#connect-person').value}-${$('#connect-day').value}`);
  if (active === record) { ++loadingToken; audio.pause(); audio.removeAttribute('src'); audio.load(); active = null; }
  if (record.src.startsWith('blob:')) URL.revokeObjectURL(record.src);
  record.src = URL.createObjectURL(file);
  record.title = file.name.replace(/\.[^.]+$/, '');
  record.context = '내 녹음 · 이 세션에서 연결됨';
  record.duration = '—';
  record.demo = false;
  record.element.querySelector('.record-title').textContent = record.title;
  record.element.querySelector('.record-context').textContent = record.context;
  record.element.querySelector('.sample-label').textContent = 'LOCAL';
  record.element.querySelector('.record-time').textContent = '—';
  $('#connect-dialog').close();
  $('#connect-file').value = '';
  playRecord(record);
});
window.addEventListener('beforeunload', () => { for (const record of records.values()) if (record.src.startsWith('blob:')) URL.revokeObjectURL(record.src); });
