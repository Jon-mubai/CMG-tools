/*
 * Author: zcl (MuBai)
 * Date: 2026-10-14
 * Role: Full-Stack Developer
 */
'use strict';

function getPublicConfig() {
  return {
    contactAdminUrl: process.env.CMG_CONTACT_ADMIN_URL || '',
    appName: process.env.CMG_APP_NAME || 'WMS-Tec',
    apiModeDefault: process.env.CMG_API_MODE_DEFAULT || 'local',
    preferServerLogin: String(process.env.CMG_PREFER_SERVER_LOGIN || '0') === '1',
    localVaultDemoOnly: String(process.env.CMG_LOCAL_VAULT_DEMO || '1') === '1'
  };
}

module.exports = { getPublicConfig: getPublicConfig };
