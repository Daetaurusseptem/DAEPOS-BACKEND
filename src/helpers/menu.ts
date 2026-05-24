export const getMenuFrontEnd = (role = 'admin', permissions: string[] = []) => {
  const menu: any = [];

  if (role === 'companyAdmin') {
    menu.push(
      {
        id: 'control-corporativo',
        title: 'Torre de Control',
        icon: 'bi bi-building',
        submenu: [
          { title: 'Dashboard', url: 'admin', icon: 'bi bi-speedometer2' },
          { title: 'Sucursales', url: 'admin/branches', icon: 'bi bi-geo-alt-fill' },
          { title: 'Monitoreo de Cajas', url: 'admin/live-registers', icon: 'bi bi-broadcast' },
          { title: 'Bitácora de Cajas', url: 'admin/cajas-historial', icon: 'bi bi-clock-history' },
        ]
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
          { title: 'Clientes (CRM)', url: 'admin/customers', icon: 'bi bi-chat-left-heart-fill' },
        ]
      },
      {
        id: 'analiticas',
        title: 'Analíticas y Marketing',
        icon: 'bi bi-bar-chart-fill',
        submenu: [
          { title: 'Cupones & Promos', url: 'admin/promotions', icon: 'bi bi-tags-fill' },
          { title: 'Estadísticas Globales', url: 'admin/statistics', icon: 'bi bi-bar-chart-line-fill' },
          { title: 'Generar Reportes', url: 'reports', icon: 'bi bi-file-earmark-pdf-fill' },
        ]
      }
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
          { title: 'Cajeros', url: 'admin/users', icon: 'bi bi-people-fill' },
        ]
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
        ]
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
        ]
      }
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
      submenu: userSubmenu
    });
  }

  if (role === 'sysadmin') {
    menu.push({
      id: 'sysadmin-control',
      title: 'Control Global SaaS',
      icon: 'bi bi-shield-lock-fill',
      submenu: [
        { title: 'Torre de Control', url: 'sysadmin/dashboard', icon: 'bi bi-cpu-fill' },
        { title: 'Empresas', url: 'sysadmin/companies', icon: 'bi bi-building-fill' },
        { title: 'Usuarios Maestros', url: 'sysadmin/users', icon: 'bi bi-people-fill' },
      ]
    });
  }

  return menu;
};
