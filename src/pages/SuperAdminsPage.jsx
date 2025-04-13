// import React, { useState, useEffect } from 'react'; // Removido import de React
import { useState, useEffect } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getApp } from 'firebase/app';
import {
  Box, TextField, Button, Typography, Paper, CircularProgress, Alert,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, IconButton // Imports para a tabela
} from '@mui/material';
import { Delete as DeleteIcon } from '@mui/icons-material'; // Ícone para deletar
import { useToast } from "@/components/ui/use-toast"; // Import useToast

function SuperAdminsPage() {
  // Estados para o formulário
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminName, setNewAdminName] = useState('');
  const [isCreating, setIsCreating] = useState(false); // Renomeado de isLoading
  const [createError, setCreateError] = useState(null); // Renomeado de error
  const [createSuccess, setCreateSuccess] = useState(null); // Renomeado de success

  // Estados para a lista
  const [adminList, setAdminList] = useState([]);
  const [isLoadingList, setIsLoadingList] = useState(true); // Loading específico da lista
  const [listError, setListError] = useState(null); // Erro específico da lista
  const [deletingUid, setDeletingUid] = useState(null); // Estado para indicar exclusão em progresso

  // --- Hooks e Funções ---
  const { toast } = useToast(); // Inicializa o hook de toast
  const functions = getFunctions(getApp(), 'southamerica-east1');
  const createSuperAdminFunction = httpsCallable(functions, 'createSuperAdmin');
  const listSuperAdminsFunction = httpsCallable(functions, 'listSuperAdmins');
  const deleteSuperAdminFunction = httpsCallable(functions, 'deleteSuperAdmin'); // Referência para delete

  // --- Função para buscar a lista de Admins ---
  const fetchAdmins = async () => {
    console.log("Fetching admin list (mount/update)..."); // Mensagem ajustada
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

  // --- Busca a lista quando o componente monta ---
  useEffect(() => {
    fetchAdmins();
  // eslint-disable-next-line react-hooks/exhaustive-deps 
  }, []); // <<<--- Array de dependências VAZIO ---<<< 

  // --- Handler para criar admin ---
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

    try {
      const result = await createSuperAdminFunction({
        newAdminEmail: newAdminEmail,
        newAdminName: newAdminName || null,
      });

      if (result.data.status === 'success') {
        setCreateSuccess(result.data.message || 'Super Administrador criado com sucesso!');
        setNewAdminEmail('');
        setNewAdminName('');
        fetchAdmins(); // <<< --- Atualiza a lista após sucesso! --- >>>
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

  // --- Handler para deletar admin --- 
  const handleDeleteAdmin = async (uidToDelete, email) => {
      // 1. Confirmação 
      if (!window.confirm(`Tem certeza que deseja excluir o Super Administrador "${email || uidToDelete}"? Esta ação não pode ser desfeita.`)) {
          return; // Cancela se o usuário não confirmar 
      }

      // 2. Indicar loading (opcional) 
      setDeletingUid(uidToDelete);
      setCreateError(null); // Limpa outros erros/sucessos
      setCreateSuccess(null);

      try {
          // 3. Chamar a Cloud Function 
          console.log(`Attempting to delete super admin UID: ${uidToDelete}`);
          const result = await deleteSuperAdminFunction({ uidToDelete: uidToDelete });

          // 4. Verificar Resultado e Mostrar Feedback 
          if (result.data.status === 'success') {
              toast({
                  title: "Sucesso!",
                  description: result.data.message || `Super Administrador ${email || uidToDelete} excluído.`,
              });
              // 5. Atualizar a Lista 
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
          // 6. Parar indicação de loading (opcional) 
          setDeletingUid(null);
      }
  };


  return (
    <Box sx={{ padding: 3 }}>
      <Typography variant="h4" gutterBottom>
        Gerenciar Super Administradores
      </Typography>

      {/* Formulário de Criação */}
      <Paper sx={{ padding: 3, marginBottom: 4 }}>
        <Typography variant="h6" gutterBottom>
          Adicionar Novo Super Admin
        </Typography>
        <Box component="form" onSubmit={handleCreateSuperAdmin} noValidate sx={{ mt: 1 }}>
          {/* TextFields para email e nome (sem alterações) */}
          <TextField margin="normal" required fullWidth id="newAdminEmail" label="Email do Novo Super Admin" name="newAdminEmail" autoComplete="email" autoFocus value={newAdminEmail} onChange={(e) => setNewAdminEmail(e.target.value)} disabled={isCreating} />
          <TextField margin="normal" fullWidth id="newAdminName" label="Nome (Opcional)" name="newAdminName" autoComplete="name" value={newAdminName} onChange={(e) => setNewAdminName(e.target.value)} disabled={isCreating} />

          {/* Alertas e Botão (usando estados renomeados) */}
          {createError && <Alert severity="error" sx={{ mt: 2 }}>{createError}</Alert>}
          {createSuccess && <Alert severity="success" sx={{ mt: 2 }}>{createSuccess}</Alert>}
          <Button type="submit" fullWidth variant="contained" sx={{ mt: 3, mb: 2 }} disabled={isCreating}>
            {isCreating ? <CircularProgress size={24} /> : 'Criar Super Admin'}
          </Button>
        </Box>
      </Paper>

      {/* Lista de Super Admins Existentes */}
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
                        {/* Botão de Deletar */}
                        <IconButton
                           aria-label="deletar"
                           size="small"
                           onClick={() => handleDeleteAdmin(admin.uid, admin.email)} // Chama a função atualizada
                           disabled={admin.email === 'cadu.eduardo@gmail.com' || deletingUid === admin.uid} // Desabilita para você OU durante a exclusão desta linha
                           title={admin.email === 'cadu.eduardo@gmail.com' ? "Não é possível excluir o administrador principal" : "Excluir"}
                           sx={{
                                color: admin.email === 'cadu.eduardo@gmail.com' ? 'action.disabled' : (deletingUid === admin.uid ? 'action.disabled' : 'error.main')
                           }}
                        >
                          {/* Mostra loading ou ícone */}
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