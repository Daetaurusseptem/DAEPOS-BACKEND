export const getMenuFrontEnd = (role = 'admin', permissions: string[] = []) => {
  const menu: any = [];

  if (role === 'companyAdmin') {
    menu.push(
      {
        id: 'control-corporativo',
        title: 'Panel de Control',
        icon: 'bi bi-building',
        submenu: [
          { title: 'Dashboard', url: 'admin', icon: 'bi bi-speedometer2' },
          { title: 'Sucursales', url: 'admin/branches', icon: 'bi bi-geo-alt-fill' },
          { title: 'Monitoreo de Cajas', url: 'admin/live-registers', icon: 'bi bi-broadcast' },
          { title: 'Bitácora de Cajas', url: 'admin/cajas-historial', icon: 'bi bi-clock-history' },
          { title: 'Facturación y Plan', url: 'admin/billing', icon: 'bi bi-credit-card-fill' },
        ],
      },
      {
        id: 'administracion',
        title: 'Administración',
        icon: 'bi bi-shield-check',
        submenu: [
          { title: 'Catálogo Maestro', url: 'admin/products', icon: 'bi bi-bag-fill' },
          { title: 'Usuarios y Personal', url: 'admin/users', icon: 'bi bi-people-fill' },
          { title: 'Proveedores', url: 'admin/suppliers', icon: 'bi bi-file-earmark-person' },
          { title: 'Entregas y Restock', url: 'admin/suppliers/deliveries', icon: 'bi bi-truck' },
          { title: 'Auditoría On-the-Fly', url: 'admin/audits/pending', icon: 'bi bi-clipboard-check-fill' },
          { title: 'Clientes (CRM)', url: 'admin/customers', icon: 'bi bi-chat-left-heart-fill' },
        ],
      },
      {
        id: 'analiticas',
        title: 'Analíticas y Marketing',
        icon: 'bi bi-bar-chart-fill',
        submenu: [
          { title: 'Cupones & Promos', url: 'admin/promotions', icon: 'bi bi-tags-fill' },
          { title: 'Estadísticas Globales', url: 'admin/statistics', icon: 'bi bi-bar-chart-line-fill' },
          { title: 'Generar Reportes', url: 'reports', icon: 'bi bi-file-earmark-pdf-fill' },
        ],
      },
    );
  }

  if (role === 'admin') {
    menu.push(
      {
        id: 'sucursal-control',
        title: 'Control de Sucursal',
        icon: 'bi bi-shop',
        submenu: [
          { title: 'Home', url: 'admin', icon: 'bi bi-house-fill' },
          { title: 'Supervisión de Cajas', url: 'admin/live-registers', icon: 'bi bi-broadcast' },
          { title: 'Auditoría de Cajas', url: 'admin/cajas-historial', icon: 'bi bi-clock-history' },
          { title: 'Auditoría On-the-Fly', url: 'admin/audits/pending', icon: 'bi bi-clipboard-check-fill' },
          { title: 'Cajeros', url: 'admin/users', icon: 'bi bi-people-fill' },
        ],
      },
      {
        id: 'inventario-logistica',
        title: 'Inventario y Logística',
        icon: 'bi bi-box-seam',
        submenu: [
          { title: 'Mi Inventario', url: 'admin/inventory', icon: 'bi bi-box2-fill' },
          { title: 'Proveedores', url: 'admin/suppliers', icon: 'bi bi-file-earmark-person' },
          { title: 'Entregas y Restock', url: 'admin/suppliers/deliveries', icon: 'bi bi-truck' },
          { title: 'Categorías', url: 'admin/categories', icon: 'bi bi-bookmark-fill' },
          { title: 'Recetas', url: 'admin/recipes', icon: 'bi bi-backpack4' },
          { title: 'Ingredientes', url: 'admin/raw-materials', icon: 'bi bi-egg-fill' },
        ],
      },
      {
        id: 'comercial-reportes',
        title: 'Comercial y Reportes',
        icon: 'bi bi-receipt',
        submenu: [
          { title: 'Clientes (CRM)', url: 'admin/customers', icon: 'bi bi-people-fill' },
          { title: 'Cupones & Promos', url: 'admin/promotions', icon: 'bi bi-tags-fill' },
          { title: 'Ventas del Día', url: 'admin/statistics', icon: 'bi bi-bar-chart-fill' },
          { title: 'Generar Reportes', url: 'reports', icon: 'bi bi-file-earmark-pdf-fill' },
          { title: 'Impresoras', url: 'admin/manage-printers', icon: 'bi bi-printer' },
        ],
      },
    );
  }

  if (role === 'user') {
    const userSubmenu = [
      { title: 'Nueva Venta', url: 'user/new-sale', icon: 'bi bi-cart-plus-fill' },
      { title: 'Ver Stock', url: 'user/inventory-available', icon: 'bi bi-search' },
      { title: 'Ventas de Hoy', url: 'user/daily-sales', icon: 'bi bi-calendar-check' },
    ];

    if (permissions.includes('inventory_management')) {
      userSubmenu.push({ title: 'Gestión Inventario', url: 'admin/inventory', icon: 'bi bi-box-seam' });
    }

    menu.push({
      id: 'punto-venta',
      title: 'Punto de Venta',
      icon: 'bi bi-cart',
      submenu: userSubmenu,
    });
  }

  if (role === 'sysadmin') {
    menu.push({
      id: 'sysadmin-control',
      title: 'Control Global SaaS',
      icon: 'bi bi-shield-lock-fill',
      submenu: [
        { title: 'Panel de Telemetría', url: 'sysadmin/dashboard', icon: 'bi bi-cpu-fill' },
        { title: 'Auditoría Transaccional', url: 'sysadmin/transactions', icon: 'bi bi-search' },
        { title: 'Auditoría de Logs', url: 'sysadmin/logs', icon: 'bi bi-terminal' },
        { title: 'Monitor de Suscripciones', url: 'sysadmin/subscriptions', icon: 'bi bi-wallet2' },
        { title: 'Validación de Pagos', url: 'sysadmin/manual-payments', icon: 'bi bi-cash-coin' },
        { title: 'Tiers & Planes (SaaS)', url: 'sysadmin/tiers', icon: 'bi bi-layers-fill' },
        { title: 'Ajustes Globales', url: 'sysadmin/global-settings', icon: 'bi bi-gear-fill' },
        { title: 'Empresas', url: 'sysadmin/companies', icon: 'bi bi-building-fill' },
        { title: 'Usuarios Maestros', url: 'sysadmin/users', icon: 'bi bi-people-fill' },
      ],
    });
  }

  if (role === 'kitchen') {
    menu.push({
      id: 'cocina-kds',
      title: 'Cocina & KDS',
      icon: 'bi bi-fire text-danger',
      submenu: [{ title: 'Pantalla KDS', url: 'kitchen/kds', icon: 'bi bi-display-fill' }],
    });
  }

  return menu;
};
