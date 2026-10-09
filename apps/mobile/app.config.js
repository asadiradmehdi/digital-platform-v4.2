// One codebase, two installable apps: the customer app and a thin admin shell (APP_VARIANT=admin) that opens
// the admin console in a full-screen, store-less window with its own icon name and package id.
const base = require('./app.base.json').expo;
const admin = process.env.APP_VARIANT === 'admin';

module.exports = () => ({
  expo: {
    ...base,
    name: admin ? 'مدیریت زُحل پی' : base.name,
    slug: admin ? 'zohalpay-admin' : base.slug,
    scheme: admin ? 'zohalpayadmin' : base.scheme,
    android: { ...base.android, package: admin ? 'com.digitalplatform.admin' : base.android.package },
    ios: { ...base.ios, bundleIdentifier: admin ? 'com.digitalplatform.admin' : base.ios.bundleIdentifier },
    extra: { ...base.extra, variant: admin ? 'admin' : 'customer' },
  },
});
