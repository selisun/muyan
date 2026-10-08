/* 牧颜 · 牛牛模板
 * 3 头几何卡通牛（大牛/奶牛/小牛犊）站在登录页左侧牧场草地上：
 *   眼球跟随鼠标 / 随机眨眼 / 聚焦输入框时倾斜踮脚偷看 /
 *   密码框聚焦时害羞闭眼 / 密码明文时忍不住随机偷瞄 /
 *   空闲时周期性低头吃草（咀嚼动作），聚焦输入框立即抬头
 * 由 default.conf 注入脚本在模板为 cow 时动态加载（/static/lhg-cow.js）
 */
(function () {
  if (window.__muyanCow) return;
  window.__muyanCow = true;

  var MAX_PUPIL = 7; // 瞳孔最大偏移 px

  // ---------- 登录卡片探测（与注入脚本同一套特征逻辑） ----------
  function findCard() {
    var c = document.querySelector('.gradient-border');
    if (c) return c;
    var p = document.querySelector('input[type=password]');
    if (!p) return null;
    var e = p;
    for (var i = 0; i < 12 && e; i++) {
      if (e.querySelectorAll('input').length >= 2) return e;
      e = e.parentElement;
    }
    return e;
  }

  // ---------- SVG 牛 ----------
  // colors: {body, head, ear, nose, nostril}；spots=true 时为奶牛花纹
  function cowSVG(c, spots) {
    var s = '<svg viewBox="0 0 200 300" xmlns="http://www.w3.org/2000/svg" style="display:block;width:100%;height:auto;overflow:visible">';
    // 身体（低头吃草时身体不动）
    s += '<rect x="45" y="125" width="110" height="170" rx="48" fill="' + c.body + '"/>';
    if (spots) {
      s += '<ellipse cx="72" cy="185" rx="24" ry="19" fill="#3a3a3a"/>';
      s += '<ellipse cx="132" cy="240" rx="18" ry="22" fill="#3a3a3a"/>';
    }
    // 头部组（吃草时整体低头 + 咀嚼）
    s += '<g class="my-head">';
    // 角
    s += '<path d="M62 40 Q50 12 72 22" stroke="#E8DCC8" stroke-width="9" fill="none" stroke-linecap="round"/>';
    s += '<path d="M138 40 Q150 12 128 22" stroke="#E8DCC8" stroke-width="9" fill="none" stroke-linecap="round"/>';
    // 耳朵
    s += '<ellipse cx="40" cy="62" rx="20" ry="12" fill="' + c.ear + '" transform="rotate(-22 40 62)"/>';
    s += '<ellipse cx="160" cy="62" rx="20" ry="12" fill="' + c.ear + '" transform="rotate(22 160 62)"/>';
    // 头
    s += '<circle cx="100" cy="88" r="58" fill="' + c.head + '"/>';
    if (spots) s += '<ellipse cx="126" cy="62" rx="21" ry="17" fill="#3a3a3a"/>';
    // 眼睛（眼眶 + 可动瞳孔）
    s += '<g class="my-eye"><ellipse cx="78" cy="82" rx="15" ry="17" fill="#fff"/>';
    s += '<circle class="my-pupil" cx="78" cy="82" r="6.5" fill="#2D2D2D"/></g>';
    s += '<g class="my-eye"><ellipse cx="122" cy="82" rx="15" ry="17" fill="#fff"/>';
    s += '<circle class="my-pupil" cx="122" cy="82" r="6.5" fill="#2D2D2D"/></g>';
    // 鼻子 + 鼻孔 + 微笑
    s += '<ellipse cx="100" cy="124" rx="27" ry="19" fill="' + c.nose + '"/>';
    s += '<circle cx="91" cy="122" r="4.5" fill="' + c.nostril + '"/>';
    s += '<circle cx="109" cy="122" r="4.5" fill="' + c.nostril + '"/>';
    s += '<path d="M90 139 Q100 146 110 139" stroke="' + c.nostril + '" stroke-width="3" fill="none" stroke-linecap="round"/>';
    s += '</g>';
    // 脚下青草簇（低头时牛嘴正好贴在草上）
    s += '<g class="my-grass" stroke="#3F7D2E" stroke-width="4" stroke-linecap="round" fill="none">';
    s += '<path d="M82 300 q-7 -22 -3 -40"/>';
    s += '<path d="M92 300 q-3 -26 3 -44"/>';
    s += '<path d="M103 300 q3 -25 10 -40"/>';
    s += '<path d="M115 300 q9 -19 14 -33"/>';
    s += '</g>';
    // 草地上的小花
    s += '<circle cx="64" cy="290" r="3.2" fill="#FFFFFF"/>';
    s += '<circle cx="134" cy="293" r="3" fill="#FFF3B0"/>';
    s += '</svg>';
    return s;
  }

  // ---------- 全局状态 ----------
  var state = {
    mx: window.innerWidth / 2,
    my: window.innerHeight / 2,
    focus: null,          // null | 'text' | 'password'
    pwdVisible: false,    // 密码是否明文
    pwdLen: 0,
    pwdInput: null        // 密码框引用（type 可能变 text，缓存引用）
  };

  var stage = null;
  var cows = [];
  var alive = false;
  var rafId = null;
  var guardTimer = null;
  var mo = null;

  // ---------- 牛对象 ----------
  function Cow(opts) {
    var el = document.createElement('div');
    el.className = 'muyan-cow-item';
    el.style.cssText = 'position:absolute;bottom:0;left:' + opts.left
      + ';width:' + opts.size + 'px;transition:transform .35s ease;'
      + 'transform-origin:50% 100%;will-change:transform;';
    el.innerHTML = cowSVG(opts.colors, opts.spots);
    this.el = el;
    this.factor = opts.factor; // 个性反应幅度
    this.pupils = el.querySelectorAll('.my-pupil');
    this.eyes = el.querySelectorAll('.my-eye');
    this.head = el.querySelector('.my-head');
    this.shut = false;
    this.peeking = false;
    this.grazing = false; // 正在低头吃草
    this.chewTimer = null;
    this.blinkTimer = null;
    this.peekTimer = null;
    this.grazeTimer = null;
    this.grazeEndTimer = null;
  }

  // 低头吃草 / 抬头
  Cow.prototype.setGrazing = function (g) {
    if (this.grazing === g) return;
    this.grazing = g;
    var self = this;
    if (g) {
      // 低头：闭眼专注吃草，0.5s 低头到位后开始轻柔咀嚼
      this.setShut(true);
      this.el.classList.add('my-graze');
      clearTimeout(this.chewTimer);
      this.chewTimer = setTimeout(function () {
        if (self.grazing) self.el.classList.add('my-chew');
      }, 520);
    } else {
      this.el.classList.remove('my-graze', 'my-chew');
      clearTimeout(this.chewTimer);
      this.chewTimer = null;
      this.setShut(false);
    }
  };

  Cow.prototype.setShut = function (shut) {
    if (this.shut === shut) return;
    this.shut = shut;
    for (var i = 0; i < this.eyes.length; i++) {
      this.eyes[i].classList.toggle('my-shut', shut);
    }
  };

  Cow.prototype.renderEyes = function (mx, my, pr) {
    for (var i = 0; i < this.eyes.length; i++) {
      // 用眼眶（不动）的中心做基准，避免瞳孔移动后基准漂移
      var r = this.eyes[i].getBoundingClientRect();
      var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      var tx, ty;
      if (this.peeking && pr) {
        // 偷瞄：直勾勾看向密码框
        var a = Math.atan2(pr.top + pr.height / 2 - cy, pr.left + pr.width / 2 - cx);
        tx = Math.cos(a) * MAX_PUPIL;
        ty = Math.sin(a) * MAX_PUPIL;
      } else {
        var a2 = Math.atan2(my - cy, mx - cx);
        var d = Math.min(Math.sqrt((mx - cx) * (mx - cx) + (my - cy) * (my - cy)) / 25, MAX_PUPIL);
        tx = Math.cos(a2) * d;
        ty = Math.sin(a2) * d;
      }
      this.pupils[i].style.transform = 'translate(' + tx.toFixed(1) + 'px,' + ty.toFixed(1) + 'px)';
    }
  };

  Cow.prototype.render = function (st, pr) {
    var t;
    if (this.grazing && !st.focus) {
      // 吃草中：身体微蹲、重心下沉，头部低头动画由 CSS class 控制
      this.setShut(true);
      t = 'translateY(8px) scaleY(0.96)';
    } else if (st.focus === 'password' && !st.pwdVisible) {
      // 害羞：转身背对 + 闭眼，假装没看
      this.setShut(true);
      this.peeking = false;
      t = 'skewX(' + (7 * this.factor).toFixed(2) + 'deg)';
    } else if (st.pwdVisible && st.pwdLen > 0) {
      // 密码亮出：站直假装没看（偷瞄循环在背后运行）——优先级高于聚焦倾斜
      this.setShut(false);
      t = this.peeking ? 'skewX(' + (-5 * this.factor).toFixed(2) + 'deg)' : 'skewX(0deg)';
    } else if (st.focus) {
      // 偷看输入：朝表单倾斜 + 踮脚
      this.setShut(false);
      t = 'skewX(' + (-10 * this.factor).toFixed(2) + 'deg) translateX('
        + Math.round(26 * this.factor) + 'px) translateY(-12px)';
    } else {
      // 默认：身体随鼠标水平位置微微倾斜
      this.setShut(false);
      var ratio = st.mx / window.innerWidth - 0.5; // -0.5 ~ 0.5
      t = 'skewX(' + (ratio * 10 * this.factor).toFixed(2) + 'deg)';
    }
    this.el.style.transform = t;
    if (!this.shut) this.renderEyes(st.mx, st.my, pr);
  };

  Cow.prototype.blinkLoop = function () {
    var self = this;
    (function schedule() {
      self.blinkTimer = setTimeout(function () {
        if (!self.shut) {
          for (var i = 0; i < self.eyes.length; i++) self.eyes[i].classList.add('my-blink');
          setTimeout(function () {
            for (var j = 0; j < self.eyes.length; j++) self.eyes[j].classList.remove('my-blink');
          }, 150);
        }
        schedule();
      }, 3000 + Math.random() * 4000); // 3~7 秒随机
    })();
  };

  Cow.prototype.peekLoop = function () {
    var self = this;
    (function schedule() {
      self.peekTimer = setTimeout(function () {
        if (state.pwdVisible && state.pwdLen > 0 && !self.shut) {
          self.peeking = true;
          renderAll();
          setTimeout(function () {
            self.peeking = false;
            renderAll();
          }, 800); // 偷瞄 0.8 秒后心虚转回
        }
        schedule();
      }, 2000 + Math.random() * 3000); // 2~5 秒随机间隔
    })();
  };

  // 吃草循环：空闲 6~12 秒低头吃 3~5 秒；聚焦输入框时不吃，正在吃则立刻抬头
  Cow.prototype.grazeLoop = function (firstDelay) {
    var self = this;
    (function schedule(delay) {
      self.grazeTimer = setTimeout(function () {
        if (!state.focus && !self.grazing) {
          self.setGrazing(true);
          renderAll();
          self.grazeEndTimer = setTimeout(function () {
            self.setGrazing(false);
            renderAll();
            schedule(6000 + Math.random() * 6000); // 下次 6~12 秒后
          }, 3000 + Math.random() * 2000); // 吃 3~5 秒
        } else {
          schedule(2000); // 用户在输入，2 秒后再试
        }
      }, delay);
    })(firstDelay);
  };

  Cow.prototype.liftHead = function () {
    // 聚焦输入框时强制抬头，并重新排下一次吃草（避免打断后循环中断）
    if (this.grazing) {
      clearTimeout(this.grazeEndTimer);
      this.setGrazing(false);
      this.grazeLoop(6000 + Math.random() * 6000);
    }
  };

  Cow.prototype.destroy = function () {
    clearTimeout(this.blinkTimer);
    clearTimeout(this.peekTimer);
    clearTimeout(this.grazeTimer);
    clearTimeout(this.grazeEndTimer);
    clearTimeout(this.chewTimer);
  };

  // ---------- 密码框状态 ----------
  function pwdRect() {
    var p = state.pwdInput;
    if (p && document.contains(p)) return p.getBoundingClientRect();
    return null;
  }

  function updatePwdState(inputEl) {
    if (inputEl) state.pwdInput = inputEl;
    var p = state.pwdInput;
    if (p && document.contains(p)) {
      state.pwdVisible = p.type !== 'password';
      state.pwdLen = p.value ? p.value.length : 0;
    } else {
      var np = document.querySelector('input[type=password]');
      state.pwdInput = np || null;
      state.pwdVisible = false;
      state.pwdLen = np && np.value ? np.value.length : 0;
    }
  }

  // ---------- 事件监听 ----------
  function onMouseMove(e) {
    state.mx = e.clientX;
    state.my = e.clientY;
    if (!rafId) {
      rafId = requestAnimationFrame(function () {
        rafId = null;
        renderAll();
      });
    }
  }

  function onFocusIn(e) {
    var t = e.target;
    if (!t || t.tagName !== 'INPUT') return;
    // 一开始输入就把所有吃草的牛叫抬头
    for (var k = 0; k < cows.length; k++) cows[k].liftHead();
    if (t.type === 'password' || t === state.pwdInput) {
      state.focus = 'password';
      updatePwdState(t);
    } else {
      state.focus = 'text';
    }
    renderAll();
  }

  function onFocusOut() {
    state.focus = null;
    renderAll();
  }

  function onInput(e) {
    var t = e.target;
    if (!t || t.tagName !== 'INPUT') return;
    if (t.type === 'password' || t === state.pwdInput) {
      updatePwdState(t);
      renderAll();
    }
  }

  // fnOS 若提供"显示密码"切换，一般会改密码框 type 属性——MutationObserver 兜底监听
  function startObserver() {
    mo = new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) {
        if (muts[i].attributeName === 'type') {
          updatePwdState(muts[i].target);
          renderAll();
          break;
        }
      }
    });
    mo.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['type'] });
  }

  // ---------- 整体渲染 ----------
  function renderAll() {
    var pr = pwdRect();
    for (var i = 0; i < cows.length; i++) cows[i].render(state, pr);
  }

  // ---------- 生命周期 ----------
  function start() {
    if (alive) return;
    alive = true;

    // 样式
    var style = document.createElement('style');
    style.id = 'muyan-cow-style';
    style.textContent = '.muyan-cow-item .my-eye{transition:transform .15s;transform-box:fill-box;transform-origin:center;}'
      + '.muyan-cow-item .my-eye.my-blink,.muyan-cow-item .my-eye.my-shut{transform:scaleY(.08);}'
      + '.muyan-cow-item .my-pupil{transition:transform .1s ease-out;}'
      // 低头吃草：头部绕颈缓缓下探（角度放缓，不贴肚子），带一点弹跳的柔软感
      + '.muyan-cow-item .my-head{transition:transform .55s cubic-bezier(.45,.05,.35,1);transform-box:fill-box;transform-origin:50% 92%;}'
      + '.muyan-cow-item.my-graze .my-head{transform:translateY(128px) rotate(52deg);}'
      // 咀嚼：在低头姿态上做极轻幅度、带弧度的咀嚼（上下颌自然点动）
      + '.muyan-cow-item.my-graze.my-chew .my-head{animation:muyan-chew .5s ease-in-out infinite;}'
      + '@keyframes muyan-chew{0%,100%{transform:translateY(126px) rotate(49deg);}50%{transform:translateY(132px) rotate(56deg);}}';
    document.head.appendChild(style);

    // 舞台（不拦截点击）
    stage = document.createElement('div');
    stage.id = 'muyan-cow-stage';
    stage.style.cssText = 'position:fixed;left:0;right:0;top:0;bottom:0;pointer-events:none;z-index:98;';
    document.body.appendChild(stage);

    // 三头牛：大牛棕色 / 中牛奶牛花色 / 小牛犊奶油色，从左到右由大到小
    cows = [
      new Cow({
        left: '3%', size: 250, factor: 1.0, spots: false,
        colors: { body: '#8B5A2B', head: '#A06C3F', ear: '#8B5A2B', nose: '#D9A675', nostril: '#6b4a2f' }
      }),
      new Cow({
        left: '15%', size: 185, factor: 1.25, spots: true,
        colors: { body: '#F5F5F5', head: '#F5F5F5', ear: '#EDEDED', nose: '#EFB8C8', nostril: '#8a5a6a' }
      }),
      new Cow({
        left: '26%', size: 135, factor: 1.5, spots: false,
        colors: { body: '#E8D5B0', head: '#F0E1C4', ear: '#E0C9A0', nose: '#F3C6B8', nostril: '#a8766a' }
      })
    ];
    var grazeDelays = [4000, 8500, 13000]; // 三头牛错开吃草时机
    for (var i = 0; i < cows.length; i++) {
      stage.appendChild(cows[i].el);
      cows[i].blinkLoop();
      cows[i].peekLoop();
      cows[i].grazeLoop(grazeDelays[i]);
    }

    document.addEventListener('mousemove', onMouseMove, true);
    document.addEventListener('focusin', onFocusIn, true);
    document.addEventListener('focusout', onFocusOut, true);
    document.addEventListener('input', onInput, true);
    startObserver();
    renderAll();
  }

  function destroy() {
    if (!alive) return;
    alive = false;
    for (var i = 0; i < cows.length; i++) cows[i].destroy();
    cows = [];
    document.removeEventListener('mousemove', onMouseMove, true);
    document.removeEventListener('focusin', onFocusIn, true);
    document.removeEventListener('focusout', onFocusOut, true);
    document.removeEventListener('input', onInput, true);
    if (mo) { mo.disconnect(); mo = null; }
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    if (stage) { stage.remove(); stage = null; }
    var st = document.getElementById('muyan-cow-style');
    if (st) st.remove();
    state.focus = null;
    state.pwdVisible = false;
    state.pwdLen = 0;
    state.pwdInput = null;
  }

  // ---------- SPA 守卫：登录卡片出现则启动，消失（登录成功导航）则清理 ----------
  // fnOS 登录成功是 SPA 内导航不整页刷新，必须主动移除注入元素
  var guardCount = 0;
  guardTimer = setInterval(function () {
    var card = findCard();
    if (card && !alive) start();
    else if (!card && alive) destroy();
    guardCount++;
    if (guardCount > 1500) clearInterval(guardTimer); // 上限 5 分钟，与注入脚本一致
  }, 200);
})();
