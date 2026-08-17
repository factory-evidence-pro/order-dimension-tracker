import React, { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import {
    Box, Grid, Paper, Typography, TextField, Button, Chip,
    IconButton, CircularProgress, Table, TableBody, TableCell,
    TableContainer, TableHead, TableRow, TablePagination,
    Card, CardContent, Dialog, DialogTitle, DialogContent,
    DialogActions, Tooltip, InputAdornment, Alert, Divider
} from '@mui/material';
import {
    Refresh, Download, Search, Save, QrCodeScanner,
    CheckCircle, Pending, FilterList
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { useAuth } from '../../hooks/useAuth';
import { orderApi } from '../../services/api';

const StatCard = ({ title, value, icon, color }: any) => (
    <Card>
        <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                    <Typography color="textSecondary" variant="caption">{title}</Typography>
                    <Typography variant="h4" sx={{ mt: 1 }}>{value}</Typography>
                </Box>
                <Box sx={{ p: 1, borderRadius: 2, bgcolor: `${color}20`, color }}>
                    {icon}
                </Box>
            </Box>
        </CardContent>
    </Card>
);

export const Dashboard: React.FC = () => {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [search, setSearch] = useState('');
    const [startDate, setStartDate] = useState<Date | null>(null);
    const [endDate, setEndDate] = useState<Date | null>(null);
    const [status, setStatus] = useState('ALL');
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(50);
    const [trackingNumber, setTrackingNumber] = useState('');
    const [dimensions, setDimensions] = useState({ l: '', w: '', h: '' });
    const [selectedOrder, setSelectedOrder] = useState<any>(null);
    const [exportDialogOpen, setExportDialogOpen] = useState(false);

    // Fetch orders
    const { data, isLoading, refetch } = useQuery({
        queryKey: ['orders', search, startDate, endDate, status, page, rowsPerPage],
        queryFn: async () => {
            const params: any = {
                page: page + 1,
                limit: rowsPerPage,
                search: search || undefined,
                status: status === 'ALL' ? undefined : status,
                startDate: startDate?.toISOString().split('T')[0],
                endDate: endDate?.toISOString().split('T')[0],
            };
            const response = await orderApi.getOrders({ params });
            return response.data;
        },
        staleTime: 30000,
        keepPreviousData: true,
    });

    // Lookup order
    const lookupOrder = useCallback(async (tracking: string) => {
        try {
            const response = await orderApi.getOrderByTracking(tracking);
            const order = response.data.data;
            setSelectedOrder(order);

            if (order.dimensions) {
                const dims = order.dimensions.split('×').map((d: string) => d.trim());
                if (dims.length === 3) {
                    setDimensions({ l: dims[0], w: dims[1], h: dims[2] });
                }
            }
            toast.success('Order found');
        } catch (error: any) {
            if (error.response?.status === 404) {
                const check = await orderApi.checkOrder(tracking);
                if (check.data.exists) {
                    toast.info('Order exists in BigSeller but not scanned yet');
                } else {
                    toast.error('Order not found in BigSeller data');
                }
            } else {
                toast.error('Error looking up order');
            }
            setSelectedOrder(null);
        }
    }, []);

    // Save dimensions
    const saveMutation = useMutation({
        mutationFn: orderApi.saveDimensions,
        onSuccess: () => {
            toast.success('Dimensions saved successfully');
            queryClient.invalidateQueries({ queryKey: ['orders'] });
            setSelectedOrder(null);
            setDimensions({ l: '', w: '', h: '' });
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.error || 'Failed to save dimensions');
        }
    });

    // Refresh data
    const refreshMutation = useMutation({
        mutationFn: orderApi.refreshData,
        onSuccess: (data) => {
            toast.success(data.data.message || 'Data refreshed');
            queryClient.invalidateQueries({ queryKey: ['orders'] });
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.error || 'Refresh failed');
        }
    });

    const handleSave = () => {
        if (!selectedOrder) {
            toast.warning('Please lookup an order first');
            return;
        }

        const { l, w, h } = dimensions;
        if (!l || !w || !h) {
            toast.warning('Please enter all dimensions');
            return;
        }

        saveMutation.mutate({
            trackingNumber: selectedOrder.tracking_number,
            orderNumber: selectedOrder.order_number,
            dimensions: `${l} × ${w} × ${h}`,
            skus: selectedOrder.skus,
            quantity: selectedOrder.quantity,
        });
    };

    // Stats
    const stats = data?.data?.reduce((acc: any, order: any) => {
        acc.total++;
        if (order.status === 'SAVED') acc.saved++;
        if (order.status === 'PENDING') acc.pending++;
        return acc;
    }, { total: 0, saved: 0, pending: 0 }) || { total: 0, saved: 0, pending: 0 };

    return (
        <LocalizationProvider dateAdapter={AdapterDateFns}>
            <Box sx={{ maxWidth: '1400px', margin: '0 auto' }}>
                {/* Header */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                    <Typography variant="h5">
                        Dashboard
                        <Typography variant="body2" color="textSecondary" sx={{ mt: 0.5 }}>
                            Welcome back, {user?.full_name || user?.username}
                        </Typography>
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button
                            variant="outlined"
                            startIcon={refreshMutation.isLoading ? <CircularProgress size={20} /> : <Refresh />}
                            onClick={() => refreshMutation.mutate()}
                            disabled={refreshMutation.isLoading}
                        >
                            Sync BigSeller
                        </Button>
                        <Button
                            variant="contained"
                            startIcon={<Download />}
                            onClick={() => setExportDialogOpen(true)}
                        >
                            Export
                        </Button>
                    </Box>
                </Box>

                {/* Stats */}
                <Grid container spacing={3} sx={{ mb: 3 }}>
                    <Grid item xs={12} sm={4}>
                        <StatCard title="Total Orders" value={stats.total} icon={<FilterList />} color="#2563eb" />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                        <StatCard title="Dimensions Saved" value={stats.saved} icon={<CheckCircle />} color="#22c55e" />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                        <StatCard title="Pending" value={stats.pending} icon={<Pending />} color="#eab308" />
                    </Grid>
                </Grid>

                {/* Main Content */}
                <Grid container spacing={3}>
                    {/* Scanner */}
                    <Grid item xs={12} md={4}>
                        <Paper sx={{ p: 3 }}>
                            <Typography variant="h6" gutterBottom>
                                <QrCodeScanner sx={{ mr: 1, verticalAlign: 'middle' }} />
                                Scan Order
                            </Typography>
                            <Divider sx={{ my: 2 }} />

                            <TextField
                                fullWidth
                                label="Tracking Number"
                                placeholder="Scan or enter tracking..."
                                value={trackingNumber}
                                onChange={(e) => setTrackingNumber(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && lookupOrder(trackingNumber)}
                                InputProps={{
                                    endAdornment: (
                                        <InputAdornment position="end">
                                            <IconButton onClick={() => lookupOrder(trackingNumber)}>
                                                <Search />
                                            </IconButton>
                                        </InputAdornment>
                                    )
                                }}
                                sx={{ mb: 2 }}
                            />

                            {selectedOrder && (
                                <Box sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 1, mb: 2 }}>
                                    <Typography variant="caption" color="textSecondary">Order Details</Typography>
                                    <Box sx={{ mt: 1 }}>
                                        <Typography variant="body2"><strong>Order #:</strong> {selectedOrder.order_number || '-'}</Typography>
                                        <Typography variant="body2"><strong>Tracking:</strong> {selectedOrder.tracking_number}</Typography>
                                        <Typography variant="body2"><strong>SKUs:</strong> {selectedOrder.skus || '-'}</Typography>
                                        <Typography variant="body2"><strong>Qty:</strong> {selectedOrder.quantity || 0}</Typography>
                                        <Box sx={{ mt: 1 }}>
                                            <Chip
                                                label={selectedOrder.status}
                                                size="small"
                                                color={selectedOrder.status === 'SAVED' ? 'success' : 'warning'}
                                            />
                                        </Box>
                                    </Box>
                                </Box>
                            )}

                            <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mb: 1 }}>
                                Dimensions (L × W × H)
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                                <TextField
                                    label="L"
                                    type="number"
                                    value={dimensions.l}
                                    onChange={(e) => setDimensions({ ...dimensions, l: e.target.value })}
                                    size="small"
                                    disabled={!selectedOrder}
                                    sx={{ flex: 1 }}
                                />
                                <Typography sx={{ alignSelf: 'center' }}>×</Typography>
                                <TextField
                                    label="W"
                                    type="number"
                                    value={dimensions.w}
                                    onChange={(e) => setDimensions({ ...dimensions, w: e.target.value })}
                                    size="small"
                                    disabled={!selectedOrder}
                                    sx={{ flex: 1 }}
                                />
                                <Typography sx={{ alignSelf: 'center' }}>×</Typography>
                                <TextField
                                    label="H"
                                    type="number"
                                    value={dimensions.h}
                                    onChange={(e) => setDimensions({ ...dimensions, h: e.target.value })}
                                    size="small"
                                    disabled={!selectedOrder}
                                    sx={{ flex: 1 }}
                                />
                            </Box>

                            <Button
                                fullWidth
                                variant="contained"
                                startIcon={saveMutation.isLoading ? <CircularProgress size={20} /> : <Save />}
                                onClick={handleSave}
                                disabled={!selectedOrder || !dimensions.l || !dimensions.w || !dimensions.h || saveMutation.isLoading}
                            >
                                {saveMutation.isLoading ? 'Saving...' : 'Save Dimensions'}
                            </Button>
                        </Paper>
                    </Grid>

                    {/* Orders Table */}
                    <Grid item xs={12} md={8}>
                        <Paper sx={{ p: 3 }}>
                            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2 }}>
                                <TextField
                                    placeholder="Search by tracking..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    size="small"
                                    sx={{ flex: 1, minWidth: 200 }}
                                    InputProps={{
                                        startAdornment: <Search sx={{ mr: 1, color: 'action.active' }} />
                                    }}
                                />
                                <DatePicker
                                    label="Start Date"
                                    value={startDate}
                                    onChange={setStartDate}
                                    slotProps={{ textField: { size: 'small' } }}
                                />
                                <DatePicker
                                    label="End Date"
                                    value={endDate}
                                    onChange={setEndDate}
                                    slotProps={{ textField: { size: 'small' } }}
                                />
                                <TextField
                                    select
                                    size="small"
                                    label="Status"
                                    value={status}
                                    onChange={(e) => setStatus(e.target.value)}
                                    sx={{ minWidth: 120 }}
                                    SelectProps={{ native: true }}
                                >
                                    <option value="ALL">All</option>
                                    <option value="PENDING">Pending</option>
                                    <option value="SAVED">Saved</option>
                                </TextField>
                                <Tooltip title="Refresh">
                                    <IconButton onClick={() => refetch()}>
                                        <Refresh />
                                    </IconButton>
                                </Tooltip>
                            </Box>

                            {isLoading ? (
                                <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                                    <CircularProgress />
                                </Box>
                            ) : (
                                <>
                                    <TableContainer>
                                        <Table size="small">
                                            <TableHead>
                                                <TableRow>
                                                    <TableCell>Tracking #</TableCell>
                                                    <TableCell>SKUs</TableCell>
                                                    <TableCell align="center">Qty</TableCell>
                                                    <TableCell>Dimensions</TableCell>
                                                    <TableCell>Status</TableCell>
                                                    <TableCell>Date</TableCell>
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {data?.data?.map((order: any) => (
                                                    <TableRow
                                                        key={order.id}
                                                        hover
                                                        onClick={() => {
                                                            setTrackingNumber(order.tracking_number);
                                                            lookupOrder(order.tracking_number);
                                                        }}
                                                        sx={{ cursor: 'pointer' }}
                                                    >
                                                        <TableCell>
                                                            <Typography variant="body2" fontWeight="medium">
                                                                {order.tracking_number}
                                                            </Typography>
                                                        </TableCell>
                                                        <TableCell>{order.skus || '-'}</TableCell>
                                                        <TableCell align="center">{order.quantity || 0}</TableCell>
                                                        <TableCell>{order.dimensions || '-'}</TableCell>
                                                        <TableCell>
                                                            <Chip
                                                                label={order.status}
                                                                size="small"
                                                                color={order.status === 'SAVED' ? 'success' : 'warning'}
                                                            />
                                                        </TableCell>
                                                        <TableCell>
                                                            {order.date_scanned ?
                                                                new Date(order.date_scanned).toLocaleDateString() :
                                                                '-'
                                                            }
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </TableContainer>

                                    <TablePagination
                                        rowsPerPageOptions={[25, 50, 100]}
                                        component="div"
                                        count={data?.pagination?.total || 0}
                                        rowsPerPage={rowsPerPage}
                                        page={page}
                                        onPageChange={(_, p) => setPage(p)}
                                        onRowsPerPageChange={(e) => {
                                            setRowsPerPage(parseInt(e.target.value, 10));
                                            setPage(0);
                                        }}
                                    />
                                </>
                            )}
                        </Paper>
                    </Grid>
                </Grid>

                {/* Export Dialog */}
                <Dialog open={exportDialogOpen} onClose={() => setExportDialogOpen(false)} maxWidth="sm" fullWidth>
                    <DialogTitle>Export Orders</DialogTitle>
                    <DialogContent>
                        <Box sx={{ pt: 2 }}>
                            <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                                Export orders as CSV file. Filter by date range.
                            </Typography>
                            <DatePicker
                                label="Start Date"
                                value={startDate}
                                onChange={setStartDate}
                                slotProps={{ textField: { fullWidth: true, sx: { mb: 2 } } }}
                            />
                            <DatePicker
                                label="End Date"
                                value={endDate}
                                onChange={setEndDate}
                                slotProps={{ textField: { fullWidth: true } }}
                            />
                        </Box>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setExportDialogOpen(false)}>Cancel</Button>
                        <Button
                            variant="contained"
                            onClick={async () => {
                                try {
                                    const response = await orderApi.exportOrders({
                                        params: {
                                            startDate: startDate?.toISOString().split('T')[0],
                                            endDate: endDate?.toISOString().split('T')[0],
                                        }
                                    });
                                    const url = window.URL.createObjectURL(response.data);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = `orders-${new Date().toISOString().split('T')[0]}.csv`;
                                    a.click();
                                    window.URL.revokeObjectURL(url);
                                    toast.success('Export successful');
                                    setExportDialogOpen(false);
                                } catch (error) {
                                    toast.error('Export failed');
                                }
                            }}
                        >
                            Download CSV
                        </Button>
                    </DialogActions>
                </Dialog>
            </Box>
        </LocalizationProvider>
    );
};