import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'نظام الحضور والغياب',
    short_name: 'الحضور',
    description: 'نظام إدارة حضور وغياب الموظفين',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#3b82f6',
    dir: 'rtl',
    lang: 'ar',
    // icons: [
    //   { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    //   { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    // ],
  };
}
