# **App Name**: SaporiMobile

## Core Features:

- Authentication: Login screen with company logo (logo.jpg from /public), username, and password fields, using the API endpoint https://saporive-api.onrender.com/token for authentication.
- Session Header: Display company logo (small, left-aligned), logged-in user (center-aligned), and real-time date, time, and backend connection status (green/red indicator, right-aligned) on every screen after login.
- Initial Setup & Config: On first launch, prompt the user to select an 'asesor' (salesperson) code. Offer the option to sync Clients, Products, Pedidos, Detalle de Pedidos and Asesores data. Implement a configuration option to change the current 'asesor'.
- API Configuration File: Centralized configuration file to manage the base API URL (https://saporive-api.onrender.com) and endpoint routes for Clients, Products, Pedidos, Detalle de Pedidos, and Asesores.  See https://saporive-api.onrender.com/docs#/ for details.
- Main Menu: Bottom menu navigation with three options: 'Pedidos', 'Lista de Precios', and 'Configuración'.
- Data Models: Reflect the database schema provided (User, Asesor, Producto, Cliente, Pedido, DetallePedido).

## Style Guidelines:

- Primary color: Deep red (#8B0000), reflecting Sapori.ve's branding in a powerful and elegant way.
- Background color: Very light red (#F8E0E0), providing a gentle backdrop to contrast with the content.
- Accent color: Muted pink (#E0B0FF), used sparingly to highlight interactive elements.
- Font pairing: Use 'Poppins' (sans-serif) for headlines and shorter text, and 'PT Sans' (sans-serif) for body text.  These combine well and have good legibility.
- Simple, flat icons for menu items and status indicators. Use red, white and pink.
- Clean and spacious layout, optimized for mobile screens.
- Subtle transitions and animations for feedback on user interactions.