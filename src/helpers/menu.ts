export const getMenuFrontEnd = (role = 'admin') => {
  const menu: any = [
    {
      id: '',
      title: '',
      icon: 'mdi mdi-gauge',
      submenu: []
    }
  ];

  if (role === 'admin') {
    menu[0].title = 'ADMIN TOOLS';
    menu[0].id = 'admin';
    menu[0].icon = 'bi bi-list';
    menu[0].submenu.unshift(
      //{ title: 'Company', url: 'admin/company', icon: 'bi bi-building-fill' },
      { title: 'Home', url: 'admin', icon: 'bi bi-house-fill' },
      { title: 'Usuarios', url: 'admin/users', icon: 'bi bi-people-fill' },
      { title: 'Productos', url: 'admin/products', icon: 'bi bi-bag-fill' },
      { title: 'Proveedores', url: 'admin/suppliers', icon: 'bi bi-file-earmark-person' },
      { title: 'Inventario', url: 'admin/inventory', icon: 'bi bi-box2-fill' },
      { title: 'Categorias', url: 'admin/categories', icon: 'bi bi-bookmark-fill' },
      { title: 'recetas', url: 'admin/recipes', icon: 'bi bi-backpack4' },
      { title: 'ingredientes', url: 'admin/raw-materials', icon: 'bi bi-egg-fill' },
      { title: 'Estadisticas', url: 'admin/statistics', icon: 'bi bi-bar-chart-fill' },
      { title: 'Impresoras', url: 'admin/manage-printers', icon: 'bi bi-printer' },
    );
  }

  if (role === 'user') {
    menu[0].title = 'USUARIO TOOLS';
    menu[0].id = 'user';
    menu[0].icon = 'bi bi-cone-striped';
    menu[0].submenu.unshift(
      { title: 'Nueva Venta', url: 'user/new-sale', icon: 'bi bi-building-fill' },
      { title: 'Items', url: 'user/items', icon: 'bi bi-people-fill' },

      // { title: 'Productos', url: 'admin/products', icon: 'bi bi-bag-fill' },
      // { title: 'Proveedores', url: 'admin/products', icon: 'bi bi-file-earmark-person' },
      // { title: 'Lotes', url: 'admin/products', icon: 'bi bi-box2-fill' },
      // { title: 'Categorias', url: 'admin/categories', icon: 'bi bi-bookmark-fill' }
    );
  }

  if (role === 'sysadmin') {
    menu[0].title = 'SYSADMIN TOOLS';
    menu[0].id = 'users';
    menu[0].icon = 'bi bi-people-fill';
    menu[0].submenu.unshift(
      { title: 'companies', url: 'sysadmin/companies', icon: 'bi bi-building-fill' },
      { title: 'Usuarios', url: 'sysadmin/users', icon: 'bi bi-people-fill' },
    );
    menu[0].submenu.unshift(
      { title: 'companies', url: 'sysadmin/companies', icon: 'bi bi-building-fill' },
      { title: 'Usuarios', url: 'sysadmin/users', icon: 'bi bi-people-fill' },
    );
  }

  return menu;
};  
