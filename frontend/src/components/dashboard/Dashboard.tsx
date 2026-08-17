import React, { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import {
    Box, Grid, Paper, Typography, TextField, Button, Chip,
    IconButton, CircularProgress, Table, TableBody, TableCell,
    TableContainer, TableHead, TableRow, TablePagination,
    Card, CardContent, Dialog, DialogTitle, DialogContent,
    DialogActions, Tooltip, InputAdornment, Alert, Divider,
    Badge
} from '@mui/material';
import {
    Refresh, Download, Search, Save, QrCodeScanner,
    CheckCircle, Pending, FilterList, Warning, History,
    ContentCopy, Cancel
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { useAuth } from '../../hooks/useAuth';
import { orderApi } from '../../services/api';

const StatCard = ({ title, value, icon, color, badge }: any) => (
    <Card>
        <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                    <Typography color="textSecondary" variant="caption">{title}</Typography>
                    <Typography variant="h4" sx={{ mt: 1 }}>
                        {value}
                        {badge && (
                            <Chip 
                                size="small" 
                                label={badge} 
                                color="warning" 
                                sx={{ ml: 1, fontSize: '0.7rem' }}
                            />
                        )}
                    </Typography>
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
    const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

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

    // ✅ Lookup order with duplicate detection
    const lookupOrder = useCallback(async (tracking: string) => {
        if (!tracking) {
            toast.warning('Please enter a tracking number');
            return;
        }

        try {
            const response = await orderApi.getOrderByTracking(tracking);
            const order = response.data.data;
            
            // ✅ Check if dimensions already exist
            if (order.dimensions) {
                setSelectedOrder(order);
                toast.info(
                    `Order already has dimensions: ${order.dimensions}. You can update or force overwrite.`
                );
                // Pre-fill dimensions
                const dims = order.dimensions.split('×').map((d: string) => d.trim());
                if (dims.length === 3) {
                    setDimensions({ l: dims[0], w: dims[1], h: dims[2] });
                }
                return;
            }
            
            setSelectedOrder(order);
            toast.success('Order found - please enter dimensions');
        } catch (error: any) {
            if (error.response?.status === 404) {
                // ✅ Check if exists in BigSeller
                const check = await orderApi.checkOrder(tracking);
                if (check.data.existsInBigSeller) {
                    toast.info('Order exists in BigSeller but not scanned yet');
                    setSelectedOrder({ tracking_number: tracking, source: 'bigseller' });
                } else {
                    toast.error('Order not found in BigSeller data. Please sync first.');
                }
            } else {
                toast.error('Error looking up order');
            }
            setSelectedOrder(null);
        }
    }, []);

    // ✅ Save dimensions with duplicate handling
    const saveMutation = useMutation({
        mutationFn: async (data: any) => {
            const response = await orderApi.saveDimensions(data);
            return response.data;
        },
        onSuccess: () => {
            toast.success('Dimensions saved successfully');
            queryClient.invalidateQueries({ queryKey: ['orders'] });
            setSelectedOrder(null);
            setDimensions({ l: '', w: '', h: '' });
            setIsSubmitting(false);
        },
        onError: (error: any) => {
            setIsSubmitting(false);
            const errorData = error.response?.data;
            
            // ✅ Handle duplicate scan error
            if (errorData?.errorCode === 'DUPLICATE_SCAN') {
                setDuplicateDialogOpen(true);
                toast.warning('Duplicate scan detected!');
                return;
            }
            
            toast.error(errorData?.error || 'Failed to save dimensions');
        }
    });

    // ✅ Force overwrite mutation
    const forceOverwriteMutation = useMutation({
        mutationFn: async (data: any) => {
            const response = await orderApi.forceOverwrite(data);
            return response.data;
        },
        onSuccess: () => {
            toast.success('Dimensions force updated successfully');
            queryClient.invalidateQueries({ queryKey: ['orders'] });
            setSelectedOrder(null);
            setDimensions({ l: '', w: '', h: '' });
            setDuplicateDialogOpen(false);
            setIsSubmitting(false);
        },
        onError: (error: any) => {
            setIsSubmitting(false);
            toast.error(error.response?.data?.error || 'Failed to force overwrite');
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

        setIsSubmitting(true);
        saveMutation.mutate({
            trackingNumber: selectedOrder.tracking_number,
            orderNumber: selectedOrder.order_number,
            dimensions: `${l} × ${w} × ${h}`,
            skus: selectedOrder.skus,
            quantity: selectedOrder.quantity,
        });
    };

    const handleForceOverwrite = () => {
        const { l, w, h } = dimensions;
        forceOverwriteMutation.mutate({
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
        if (order.duplicate_scan_count > 0) acc.duplicates++;
        return acc;
    }, { total: 0, saved: 0, pending: 0, duplicates: 0 }) || { total: 0, saved: 0, pending: 0, duplicates: 0 };

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

                {/* Stats with Duplicate Indicator */}
                <Grid container spacing={3} sx={{ mb: 3 }}>
                    <Grid item xs={12} sm={3}>
                        <StatCard title="Total Orders" value={stats.total} icon={<FilterList />} color="#2563eb" />
                    </Grid>
                    <Grid item xs={12} sm={3}>
                        <StatCard title="Dimensions Saved" value={stats.saved} icon={<CheckCircle />} color="#22c55e" />
                    </Grid>
                    <Grid item xs={12} sm={3}>
                        <StatCard title="Pending" value={stats.pending} icon={<Pending />} color="#eab308" />
                    </Grid>
                    <Grid item xs={12} sm={3}>
                        <StatCard 
                            title="Duplicates" 
                            value={stats.duplicates} 
                            icon={<Warning />} 
                            color="#ef4444"
                            badge="⚠️ Needs Review"
                        />
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
                                        <Typography variant="body2">
                                            <strong>Tracking:</strong> {selectedOrder.tracking_number}
                                        </Typography>
                                        {selectedOrder.order_number && (
                                            <Typography variant="body2">
                                                <strong>Order #:</strong> {selectedOrder.order_number}
                                            </Typography>
                                        )}
                                        {selectedOrder.skus && (
                                            <Typography variant="body2">
                                                <strong>SKUs:</strong> {selectedOrder.skus}
                                            </Typography>
                                        )}
                                        {selectedOrder.quantity && (
                                            <Typography variant="body2">
                                                <strong>Qty:</strong> {selectedOrder.quantity}
                                            </Typography>
                                        )}
                                        {selectedOrder.dimensions && (
                                            <Box sx={{ mt: 1, p: 1, bgcolor: '#fef9e7', borderRadius: 1 }}>
                                                <Typography variant="body2" color="warning.main">
                                                    ⚠️ Existing Dimensions: {selectedOrder.dimensions}
                                                </Typography>
                                                {selectedOrder.duplicate_scan_count > 0 && (
                                                    <Typography variant="caption" color="error">
                                                        This order has been scanned {selectedOrder.duplicate_scan_count} time(s)
                                                    </Typography>
                                                )}
                                            </Box>
                                        )}
                                        {selectedOrder.version_count > 1 && (
                                            <Chip 
                                                size="small" 
                                                label={`${selectedOrder.version_count} versions`}
                                                icon={<History />}
                                                sx={{ mt: 1 }}
                                            />
                                        )}
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

                            {selectedOrder?.dimensions ? (
                                <>
                                    <Button
                                        fullWidth
                                        variant="contained"
                                        color="warning"
                                        startIcon={isSubmitting ? <CircularProgress size={20} /> : <Warning />}
                                        onClick={handleSave}
                                        disabled={isSubmitting || !dimensions.l || !dimensions.w || !dimensions.h}
                                        sx={{ mb: 1 }}
                                    >
                                        {isSubmitting ? 'Saving...' : 'Update Dimensions'}
                                    </Button>
                                    <Button
                                        fullWidth
                                        variant="outlined"
                                        color="error"
                                        startIcon={<ContentCopy />}
                                        onClick={() => {
                                            if (window.confirm('This will overwrite existing dimensions. Continue?')) {
                                                handleForceOverwrite();
                                            }
                                        }}
                                        disabled={isSubmitting || !dimensions.l || !dimensions.w || !dimensions.h}
                                    >
                                        Force Overwrite
                                    </Button>
                                </>
                            ) : (
                                <Button
                                    fullWidth
                                    variant="contained"
                                    startIcon={isSubmitting ? <CircularProgress size={20} /> : <Save />}
                                    onClick={handleSave}
                                    disabled={!selectedOrder || !dimensions.l || !dimensions.w || !dimensions.h || isSubmitting}
                                >
                                    {isSubmitting ? 'Saving...' : 'Save Dimensions'}
                                </Button>
                            )}
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
                                                    <TableCell>Duplicates</TableCell>
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
                                                        sx={{ 
                                                            cursor: 'pointer',
                                                            bgcolor: order.duplicate_scan_count > 0 ? '#fef2f2' : 'inherit'
                                                        }}
                                                    >
                                                        <TableCell>
                                                            <Typography variant="body2" fontWeight="medium">
                                                                {order.tracking_number}
                                                            </Typography>
                                                        </TableCell>
                                                        <TableCell>{order.skus || '-'}</TableCell>
                                                        <TableCell align="center">{order.quantity || 0}</TableCell>
                                                        <TableCell>
                                                            {order.dimensions || '-'}
                                                            {order.version_count > 1 && (
                                                                <Chip 
                                                                    size="small" 
                                                                    label={`v${order.version_count}`}
                                                                    icon={<History />}
                                                                    sx={{ ml: 1, fontSize: '0.6rem' }}
                                                                />
                                                            )}
                                                        </TableCell>
                                                        <TableCell>
                                                            <Chip 
                                                                label={order.status}
                                                                size="small"
                                                                color={order.status === 'SAVED' ? 'success' : 'warning'}
                                                            />
                                                        </TableCell>
                                                        <TableCell>
                                                            {order.duplicate_scan_count > 0 && (
                                                                <Chip 
                                                                    label={`⚠️ ${order.duplicate_scan_count}`}
                                                                    size="small"
                                                                    color="error"
                                                                    icon={<Warning />}
                                                                />
                                                            )}
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

                {/* ✅ Duplicate Dialog */}
                <Dialog open={duplicateDialogOpen} onClose={() => setDuplicateDialogOpen(false)} maxWidth="sm" fullWidth>
                    <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Warning color="warning" />
                        Duplicate Scan Detected!
                    </DialogTitle>
                    <DialogContent>
                        <Box sx={{ pt: 2 }}>
                            <Alert severity="warning" sx={{ mb: 2 }}>
                                This order already has dimensions saved.
                            </Alert>
                            <Typography variant="body2">
                                <strong>Tracking:</strong> {selectedOrder?.tracking_number}
                            </Typography>
                            <Typography variant="body2">
                                <strong>Existing Dimensions:</strong> {selectedOrder?.dimensions}
                            </Typography>
                            <Typography variant="body2">
                                <strong>New Dimensions:</strong> {dimensions.l} × {dimensions.w} × {dimensions.h}
                            </Typography>
                            <Box sx={{ mt: 2, p: 2, bgcolor: '#fef9e7', borderRadius: 1 }}>
                                <Typography variant="caption" color="warning.main">
                                    ⚠️ This is a duplicate scan. You can either:
                                    <br />1. Update with new dimensions
                                    <br />2. Force overwrite
                                    <br />3. Cancel to keep existing dimensions
                                </Typography>
                            </Box>
                        </Box>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setDuplicateDialogOpen(false)} startIcon={<Cancel />}>
                            Cancel (Keep Existing)
                        </Button>
                        <Button 
                            variant="outlined" 
                            color="warning"
                            onClick={() => {
                                setDuplicateDialogOpen(false);
                                handleSave();
                            }}
                            startIcon={<Save />}
                        >
                            Update
                        </Button>
                        <Button 
                            variant="contained" 
                            color="error"
                            onClick={() => {
                                setDuplicateDialogOpen(false);
                                handleForceOverwrite();
                            }}
                            startIcon={<ContentCopy />}
                        >
                            Force Overwrite
                        </Button>
                    </DialogActions>
                </Dialog>

                {/* Export Dialog */}
                <Dialog open={exportDialogOpen} onClose={() => setExportDialogOpen(false)} maxWidth="sm" fullWidth>
                    <DialogTitle>Export Orders</DialogTitle>
                    <DialogContent>
                        <Box sx={{ pt: 2 }}>
                            <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                                Export orders as CSV file. Includes duplicate scan information.
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
