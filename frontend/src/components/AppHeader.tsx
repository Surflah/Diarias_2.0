// frontend/src/components/AppHeader.tsx
import { AppBar, Toolbar, Typography, Avatar, Box } from '@mui/material';
import { useAuth } from '../context/AuthContext';

export default function AppHeader() {
  const { user } = useAuth();
  return (
    <AppBar position="sticky">
      <Toolbar>
        <Typography sx={{ flexGrow: 1 }}>Sistema de Diárias</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2">{user?.first_name} {user?.last_name}</Typography>
          <Avatar src={user?.picture || undefined} alt={user?.first_name || 'Usuário'} />
        </Box>
      </Toolbar>
    </AppBar>
  );
}
