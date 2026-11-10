/* profile.js — личный кабинет старосты */
const Profile = {
  renderMoreSection(container) {
    const p = State.profile;
    container.innerHTML = `
      <div class="section-label">Профиль старосты</div>
      <div class="card" style="padding-top:0">
        <div class="profile-banner" id="pf-banner" style="${p.banner ? `background-image:url(${p.banner})` : ''}"></div>
        <div class="profile-avatar-wrap">
          <div class="profile-avatar" id="pf-avatar">${p.avatar ? `<img src="${p.avatar}" alt="">` : U.initials(p.name || 'С')}</div>
        </div>
        <div class="img-btns">
          <button class="btn sm" id="pf-up-avatar">Аватарка</button>
          <button class="btn sm" id="pf-up-banner">Баннер</button>
          <button class="btn sm ghost" id="pf-rm-imgs">Убрать фото</button>
        </div>
        <input type="file" id="pf-file-avatar" accept="image/*" hidden>
        <input type="file" id="pf-file-banner" accept="image/*" hidden>
        <div class="field" style="margin-top:14px"><label>Имя старосты</label>
          <input class="input" id="pf-name" value="${U.esc(p.name)}" placeholder="Как к вам обращаться"></div>
        <div class="field"><label>Название группы</label>
          <input class="input" id="pf-group" value="${U.esc(p.group)}" placeholder="Например: ИДБ-21"></div>
        <div class="field"><label>О себе / описание</label>
          <textarea class="input" id="pf-bio" placeholder="Пара слов для группы…">${U.esc(p.bio)}</textarea></div>
        <button class="btn primary block" id="pf-save">Сохранить профиль</button>
      </div>`;

    const save = U.debounce(() => {
      Store.saveProfile({
        name: container.querySelector('#pf-name').value.trim(),
        group: container.querySelector('#pf-group').value.trim(),
        bio: container.querySelector('#pf-bio').value.trim(),
        avatar: p.avatar, banner: p.banner
      });
      Bus.emit('profile:change');
      document.getElementById('topbar-title').textContent = Store.ui().tab === 'home' ? 'Главная' : document.querySelector('.screen.active')?.dataset.title || 'Староста';
      U.toast('Профиль сохранён');
    }, 400);
    ['#pf-name','#pf-group','#pf-bio'].forEach(s =>
      container.querySelector(s).addEventListener('input', save));

    container.querySelector('#pf-save').addEventListener('click', save);

    const pick = (btnSel, fileSel, kind) => {
      container.querySelector(btnSel).addEventListener('click', () => container.querySelector(fileSel).click());
      container.querySelector(fileSel).addEventListener('change', async e => {
        const file = e.target.files[0];
        if (!file) return;
        try {
          const dataUrl = await U.compressImage(file, 150, 0.6);
          const fresh = Store.profile();
          fresh[kind] = dataUrl;
          Store.saveProfile(fresh);
          Bus.emit('profile:change');
          this.renderMoreSection(container);
          U.toast('Изображение сжато и сохранено');
        } catch { U.toast('Не удалось прочитать изображение'); }
      });
    };
    pick('#pf-up-avatar', '#pf-file-avatar', 'avatar');
    pick('#pf-up-banner', '#pf-file-banner', 'banner');

    container.querySelector('#pf-rm-imgs').addEventListener('click', () => {
      const fresh = Store.profile();
      fresh.avatar = null; fresh.banner = null;
      Store.saveProfile(fresh);
      Bus.emit('profile:change');
      this.renderMoreSection(container);
    });
  }
};
