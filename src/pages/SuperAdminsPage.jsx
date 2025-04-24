import React, { useState, useEffect } from 'react';
import { httpsCallable } from 'firebase/functions';
import { auth, functions } from '@/lib/firebaseConfig';
import {
  Box, TextField, Button, Typography, Paper, CircularProgress, Alert,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, IconButton
} from '@mui/material';
import { Delete as DeleteIcon } from '@mui/icons-material';
import { useToast } from "@/components/ui/use-toast";

const listSuperAdminsFunction = httpsCallable(functions, 'listSuperAdmins');
const deleteSuperAdminFunction = httpsCallable(functions, 'deleteSuperAdmin');

function SuperAdminsPage() {
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminName, setNewAdminName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState(null);
  const [createSuccess, setCreateSuccess] = useState(null);

  const [adminList, setAdminList] = useState([]);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [listError, setListError] = useState(null);
  const [deletingUid, setDeletingUid] = useState(null);

  const { toast } = useToast();

  const fetchAdmins = async () => {
    console.log("Fetching admin list (mount/update)...");
    setIsLoadingList(true);
    setListError(null);
    try {
      const result = await listSuperAdminsFunction();
      if (result.data.status === 'success' && Array.isArray(result.data.admins)) {
        console.log("Admin list fetched successfully:", result.data.admins);
        setAdminList(result.data.admins);
      } else {
        throw new Error(result.data.message || 'Falha ao buscar lista de administradores.');
      }
    } catch (err) {
      console.error("Erro ao buscar lista de Super Admins:", err);
      setListError(err.message || "Não foi possível carregar a lista de administradores.");
      setAdminList([]);
    } finally {
      setIsLoadingList(false);
    }
  };

  useEffect(() => {
    fetchAdmins();
  }, []);

  const handleCreateSuperAdmin = async (e) => {
    e.preventDefault();
    setIsCreating(true);
    setCreateError(null);
    setCreateSuccess(null);

    if (!newAdminEmail) {
      setCreateError("O email é obrigatório.");
      setIsCreating(false);
      return;
    }

    const createSuperAdminCallable = httpsCallable(functions, 'createSuperAdmin');

    try {
      const result = await createSuperAdminCallable({
        newAdminEmail: newAdminEmail,
        newAdminName: newAdminName || null,
      });

      if (result.data.status === 'success') {
        setCreateSuccess(result.data.message || 'Super Administrador criado com sucesso!');
        setNewAdminEmail('');
        setNewAdminName('');
        fetchAdmins();
      } else {
        throw new Error(result.data.message || 'Ocorreu um erro ao criar o Super Admin.');
      }
    } catch (err) {
      console.error("Erro ao chamar createSuperAdmin:", err);
      setCreateError(err.message || "Ocorreu uma falha ao criar o Super Admin. Verifique o email e tente novamente.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteAdmin = async (uidToDelete, email) => {
    if (!window.confirm(`Tem certeza que deseja excluir o Super Administrador "${email || uidToDelete}"? Esta ação não pode ser desfeita.`)) {
      return;
    }

    setDeletingUid(uidToDelete);
    setCreateError(null);
    setCreateSuccess(null);

    try {
      console.log(`Attempting to delete super admin UID: ${uidToDelete}`);
      const result = await deleteSuperAdminFunction({ uidToDelete: uidToDelete });

      if (result.data.status === 'success') {
        toast({
          title: "Sucesso!",
          description: result.data.message || `Super Administrador ${email || uidToDelete} excluído.`,
        });
        fetchAdmins();
      } else {
        throw new Error(result.data.message || 'Ocorreu um erro ao excluir.');
      }
    } catch (err) {
      console.error(`Erro ao deletar Super Admin ${uidToDelete}:`, err);
      toast({
        title: "Erro ao Excluir",
        description: err.message || "Não foi possível excluir o Super Administrador.",
        variant: "destructive",
      });
    } finally {
      setDeletingUid(null);
    }
  };

  return (
    <Box sx={{ padding: 3 }}>
      <Typography variant="h4" gutterBottom>
        Gerenciar Super Administradores
      </Typography>

      <Paper sx={{ padding: 3, marginBottom: 4 }}>
        <Typography variant="h6" gutterBottom>
          Adicionar Novo Super Admin
        </Typography>
        <Box component="form" onSubmit={handleCreateSuperAdmin} noValidate sx={{ mt: 1 }}>
          <TextField margin="normal" required fullWidth id="newAdminEmail" label="Email do Novo Super Admin" name="newAdminEmail" autoComplete="email" autoFocus value={newAdminEmail} onChange={(e) => setNewAdminEmail(e.target.value)} disabled={isCreating} />
          <TextField margin="normal" fullWidth id="newAdminName" label="Nome (Opcional)" name="newAdminName" autoComplete="name" value={newAdminName} onChange={(e) => setNewAdminName(e.target.value)} disabled={isCreating} />

          {createError && <Alert severity="error" sx={{ mt: 2 }}>{createError}</Alert>}
          {createSuccess && <Alert severity="success" sx={{ mt: 2 }}>{createSuccess}</Alert>}
          <Button type="submit" fullWidth variant="contained" sx={{ mt: 3, mb: 2 }} disabled={isCreating}>
            {isCreating ? <CircularProgress size={24} /> : 'Criar Super Admin'}
          </Button>
        </Box>
      </Paper>

      <Paper sx={{ padding: 3 }}>
        <Typography variant="h6" gutterBottom>
          Super Administradores Existentes
        </Typography>
        {isLoadingList && <Box sx={{ display: 'flex', justifyContent: 'center', my: 3 }}><CircularProgress /></Box>}
        {listError && <Alert severity="error" sx={{ mt: 2 }}>{listError}</Alert>}
        {!isLoadingList && !listError && (
          <TableContainer>
            <Table stickyHeader aria-label="Tabela de Super Administradores">
              <TableHead>
                <TableRow>
                  <TableCell>Email</TableCell>
                  <TableCell>Nome</TableCell>
                  <TableCell>Data de Criação</TableCell>
                  <TableCell>Último Login</TableCell>
                  <TableCell align="right">Ações</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {adminList.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center">Nenhum Super Administrador encontrado.</TableCell>
                  </TableRow>
                ) : (
                  adminList.map((admin) => (
                    <TableRow hover key={admin.uid}>
                      <TableCell>{admin.email || 'N/A'}</TableCell>
                      <TableCell>{admin.displayName || 'N/A'}</TableCell>
                      <TableCell>{admin.creationTime ? new Date(admin.creationTime).toLocaleDateString('pt-BR') : 'N/A'}</TableCell>
                      <TableCell>{admin.lastSignInTime ? new Date(admin.lastSignInTime).toLocaleString('pt-BR') : 'Nunca'}</TableCell>
                      <TableCell align="right">
                        <IconButton
                           aria-label="deletar"
                           size="small"
                           onClick={() => handleDeleteAdmin(admin.uid, admin.email)}
                           disabled={admin.email === 'cadu.eduardo@gmail.com' || deletingUid === admin.uid}
                           title={admin.email === 'cadu.eduardo@gmail.com' ? "Não é possível excluir o administrador principal" : "Excluir"}
                           sx={{
                                color: admin.email === 'cadu.eduardo@gmail.com' ? 'action.disabled' : (deletingUid === admin.uid ? 'action.disabled' : 'error.main')
                           }}
                        >
                          {deletingUid === admin.uid ? <CircularProgress size={20} color="inherit" /> : <DeleteIcon fontSize="inherit" />}
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>
    </Box>
  );
}

export default SuperAdminsPage;