/**
 * Author: zcl (MuBai)
 * Date: 2026-10-14
 * Role: Full-Stack Developer
 */
/* js/core/modal.js */
/* ===== 自定义模态弹窗 ===== */
  var modalOverlay = $('modalOverlay');
  var modalContent = $('modalContent');
  var modalOk = $('modalOk');
  var modalCancel = $('modalCancel');
  var _modalCallback = null;

  function showModal(msg, type, callback, variant) {
    /* 含 HTML 标签时按富文本渲染（如报告详情表格），否则按纯文本 */
    if (/<[a-z][\s\S]*>/i.test(String(msg))) modalContent.innerHTML = msg;
    else modalContent.textContent = msg;
    _modalCallback = callback || null;
    /* 宽度变体：'wide' = 数据表格（1040px），'form' = 表单面板（760px） */
    modalOverlay.classList.remove('modal-wide', 'modal-form');
    if (variant === 'wide') modalOverlay.classList.add('modal-wide');
    else if (variant === 'form') modalOverlay.classList.add('modal-form');
    if (variant === 'form') {
      /* 表单类弹窗自带底部操作区（取消 / 保存），
         不再渲染默认确认键，避免出现孤立的「知道了」按钮 */
      modalOk.style.display = 'none';
      modalCancel.style.display = 'none';
    } else if (type === 'confirm') {
      modalOk.style.display = '';
      modalCancel.style.display = '';
      modalOk.textContent = '确定';
    } else {
      modalOk.style.display = '';
      modalCancel.style.display = 'none';
      modalOk.textContent = '知道了';
    }
    modalOverlay.classList.add('show');
  }
  function hideModal() {
    modalOverlay.classList.remove('show');
    /* 清除宽度变体，避免影响后续普通弹窗 */
    modalOverlay.classList.remove('modal-wide', 'modal-form');
  }
  modalOk.addEventListener('click', function () {
    var cb = _modalCallback;
    hideModal();
    if (cb) cb(true);
  });
  modalCancel.addEventListener('click', function () {
    var cb = _modalCallback;
    hideModal();
    if (cb) cb(false);
  });
  modalOverlay.addEventListener('click', function (e) {
    if (e.target === modalOverlay) {
      var cb = _modalCallback;
      hideModal();
      if (cb) cb(false);
    }
  });

  window.showModal = showModal;
  window.hideModal = hideModal;
