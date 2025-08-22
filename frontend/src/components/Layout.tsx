// frontend/src/components/Layout.tsx

import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Box, Drawer, AppBar, Toolbar, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Typography, CssBaseline, Avatar, Button } from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import AddCardIcon from '@mui/icons-material/AddCard';
import { useAuth } from '../context/AuthContext';

const drawerWidth = 240;

const menuItems = [
  { text: 'Dashboard', path: '/dashboard', icon: <DashboardIcon /> },
  { text: 'Nova Diária', path: '/diarias/nova', icon: <AddCardIcon /> },
];

export const AppLayout = ({ children }: { children: React.ReactNode }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, activeRole } = useAuth();

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />
      <AppBar
        position="fixed"
        sx={{ width: `calc(100% - ${drawerWidth}px)`, ml: `${drawerWidth}px` }}
      >
        <Toolbar>
          <Typography variant="h6" noWrap component="div">
            Sistema de Diárias - Câmara de Itapoá
          </Typography>
        </Toolbar>
      </AppBar>
      <Drawer
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
          },
        }}
        variant="permanent"
        anchor="left"
      >
        <Toolbar>
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>Diárias App</Typography>
        </Toolbar>
        <Box sx={{ p: 2, borderTop: 1, borderBottom: 1, borderColor: 'divider', textAlign: 'center' }}>
            <Avatar src={user?.picture || undefined} sx={{ width: 64, height: 64, mx: 'auto', mb: 1 }} />
            <Typography variant="subtitle1" fontWeight="bold">{user?.first_name} {user?.last_name}</Typography>
            <Typography variant="body2" color="text.secondary">{user?.email}</Typography>
             {activeRole && (
              <Typography variant="body2" sx={{ mt: 1, fontWeight: 'bold' }}>
                Perfil: {activeRole}
              </Typography>
            )}
            <Button size="small" sx={{ mt: 1 }} onClick={() => navigate('/select-role')}>
              Trocar Perfil
            </Button>
        </Box>
        <List>
          {menuItems.map((item) => (
            <ListItem key={item.text} disablePadding>
              <ListItemButton
                selected={location.pathname === item.path}
                onClick={() => navigate(item.path)}
              >
                <ListItemIcon>{item.icon}</ListItemIcon>
                <ListItemText primary={item.text} />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </Drawer>
      <Box
        component="main"
        sx={{ flexGrow: 1, bgcolor: 'background.default', p: 3 }}
      >
        <Toolbar /> 
        {children}
      </Box>
    </Box>
  );
};