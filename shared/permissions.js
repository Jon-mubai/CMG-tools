/*
 * Author: zcl (MuBai)
 * Date: 2026-10-14
 * Role: Full-Stack Developer
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.CMGShared = root.CMGShared || {};
    Object.assign(root.CMGShared, factory());
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var FEATURES = [
    { key: 'dashboard', label: '数据看板' },
    { key: 'scan', label: '扫码盘点' },
    { key: 'scan-data', label: '盘点数据' },
    { key: 'wh-park', label: '仓库可视化' },
    { key: 'wh-stock', label: '库存管理' },
    { key: 'wh-docs', label: '单据设置' },
    { key: 'machine-profit', label: '机台毛利' },
    { key: 'machine-ops', label: '运营数据' },
    { key: 'machine-category', label: '品类统计' },
    { key: 'help', label: '帮助' },
    { key: 'admin-users', label: '账号权限' }
  ];
  function allFeatureKeys() {
    return FEATURES.map(function (f) { return f.key; });
  }
  function defaultUserFeatures() {
    return FEATURES.filter(function (f) { return f.key !== 'admin-users'; }).map(function (f) { return f.key; });
  }
  return {
    FEATURES: FEATURES,
    allFeatureKeys: allFeatureKeys,
    defaultUserFeatures: defaultUserFeatures
  };
});
