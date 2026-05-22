export const getMenuFrontEnd = (role = 'admin', permissions: string[] = []) => {
  const menu: any = [
    {
      id: '',
      title: '',
      icon: 'mdi mdi-gauge',
      submenu: []
    }
  ];

  if (role === 'companyAdmin') {
    menu[0].title = 'COMPANY ADMIN';
    menu[0].id = 'company-admin';
    menu[0].icon = 'bi bi-building';
    menu[0].submenu.unshift(
      { title: 'Dashboard', url: 'admin', icon: 'bi bi-speedometer2' },
      { title: 'Sucursales', url: 'admin/branches', icon: 'bi bi-geo-alt-fill' },
      { title: 'Monitoreo de Cajas', url: 'admin/live-registers', icon: 'bi bi-broadcast' },
      { title: 'Bitácora de Cajas', url: 'admin/cajas-historial', icon: 'bi bi-clock-history' },
      { title: 'Catálogo Maestro', url: 'admin/products', icon: 'bi bi-bag-fill' },
      { title: 'Usuarios', url: 'admin/users', icon: 'bi bi-people-fill' },
      { title: 'Proveedores', url: 'admin/suppliers', icon: 'bi bi-file-earmark-person' },
      { title: 'Entregas y Restock', url: 'admin/suppliers/deliveries', icon: 'bi bi-truck' },
      { title: 'Clientes (CRM)', url: 'admin/customers', icon: 'bi bi-people-fill' },
      { title: 'Cupones & Promos', url: 'admin/promotions', icon: 'bi bi-tags-fill' },
      { title: 'Estadísticas Globales', url: 'admin/statistics', icon: 'bi bi-bar-chart-line-fill' },
    );
  }

  if (role === 'admin') {
    menu[0].title = 'SUCURSAL TOOLS';
    menu[0].id = 'admin';
    menu[0].icon = 'bi bi-shop';
    menu[0].submenu.unshift(
      { title: 'Home', url: 'admin', icon: 'bi bi-house-fill' },
      { title: 'Supervisión de Cajas', url: 'admin/live-registers', icon: 'bi bi-broadcast' },
      { title: 'Auditoría de Cajas', url: 'admin/cajas-historial', icon: 'bi bi-clock-history' },
      { title: 'Cajeros', url: 'admin/users', icon: 'bi bi-people-fill' },
      { title: 'Mi Inventario', url: 'admin/inventory', icon: 'bi bi-box2-fill' },
      { title: 'Entregas y Restock', url: 'admin/suppliers/deliveries', icon: 'bi bi-truck' },
      { title: 'Categorias', url: 'admin/categories', icon: 'bi bi-bookmark-fill' },
      { title: 'Recetas', url: 'admin/recipes', icon: 'bi bi-backpack4' },
      { title: 'Ingredientes', url: 'admin/raw-materials', icon: 'bi bi-egg-fill' },
      { title: 'Clientes (CRM)', url: 'admin/customers', icon: 'bi bi-people-fill' },
      { title: 'Cupones & Promos', url: 'admin/promotions', icon: 'bi bi-tags-fill' },
      { title: 'Ventas del Día', url: 'admin/statistics', icon: 'bi bi-bar-chart-fill' },
      { title: 'Impresoras', url: 'admin/manage-printers', icon: 'bi bi-printer' },
    );
  }

  if (role === 'user') {
    menu[0].title = 'USUARIO TOOLS';
    menu[0].id = 'user';
    menu[0].icon = 'bi bi-person-badge';
    menu[0].submenu.unshift(
      { title: 'Nueva Venta', url: 'user/new-sale', icon: 'bi bi-cart-plus-fill' },
      { title: 'Ver Stock', url: 'user/inventory-available', icon: 'bi bi-search' },
      { title: 'Ventas de Hoy', url: 'user/daily-sales', icon: 'bi bi-calendar-check' },
    );

    if (permissions.includes('inventory_management')) {
      menu[0].submenu.push({ title: 'Gestión Inventario', url: 'admin/inventory', icon: 'bi bi-box-seam' });
    }
  }

  if (role === 'sysadmin') {
    menu[0].title = 'SYSADMIN TOOLS';
    menu[0].id = 'sysadmin';
    menu[0].icon = 'bi bi-shield-lock-fill';
    menu[0].submenu.unshift(
      { title: 'Torre de Control', url: 'sysadmin/dashboard', icon: 'bi bi-cpu-fill' },
      { title: 'Empresas', url: 'sysadmin/companies', icon: 'bi bi-building-fill' },
      { title: 'Usuarios Maestros', url: 'sysadmin/users', icon: 'bi bi-people-fill' },
    );
  }

  return menu;
};  
