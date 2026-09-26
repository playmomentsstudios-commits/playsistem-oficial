import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { CartProvider } from './contexts/CartContext'
import { ToastProvider } from './contexts/ToastContext'
import { useAuth } from './contexts/AuthContext'

// Layouts
import { CustomerLayoutV2 } from './layouts/CustomerLayoutV2'
import { AdminLayout } from './layouts/AdminLayout'

// Public pages
import { HomePage } from './pages/public/HomePage'
import { LoginPage } from './pages/public/LoginPage'
import { RegisterPage } from './pages/public/RegisterPage'
import { EmailConfirmedPage } from './pages/public/EmailConfirmedPage'
import { ForgotPasswordPage } from './pages/public/ForgotPasswordPage'
import { ResetPasswordPage } from './pages/public/ResetPasswordPage'
import { CartPage } from './pages/public/CartPage'
import { CommunityPage } from './pages/public/CommunityPage'
import { ProductsPage } from './pages/public/ProductsPage'
import { ProductDetailPage } from './pages/public/ProductDetailPage'
import { AboutPage } from './pages/public/AboutPage'
import { CategoryPage } from './pages/public/CategoryPage'

// Customer portal
import { DashboardPage } from './pages/customer/DashboardPage'
import { ProfilePage } from './pages/customer/ProfilePage'
import { OrdersPage } from './pages/customer/OrdersPage'
import { QuotesPage } from './pages/customer/QuotesPage'
import { ConversationsPage } from './pages/customer/ConversationsPage'
import { FilesPage } from './pages/customer/FilesPage'
import { NotificationsPage } from './pages/customer/NotificationsPage'
import { PaymentsPage } from './pages/customer/PaymentsPage'
import { ProjectsPage } from './pages/customer/ProjectsPage'
import { CustomerServicesPage } from './pages/customer/CustomerServicesPage'
import { AnnouncementsPage } from './pages/customer/AnnouncementsPage'
import { OrderDetailPage } from './pages/customer/OrderDetailPage'
import { QuoteDetailPage } from './pages/customer/QuoteDetailPage'
import { CustomerSettings } from './pages/customer/CustomerSettings'

// Admin panel
import { AdminDashboard } from './pages/admin/AdminDashboard'
import { AdminCustomers } from './pages/admin/AdminCustomers'
import { AdminProducts } from './pages/admin/AdminProducts'
import { AdminOrders } from './pages/admin/AdminOrders'
import { AdminConversations } from './pages/admin/AdminConversations'
import { AdminSiteSettings } from './pages/admin/AdminSiteSettings'
import { AdminCommunity } from './pages/admin/AdminCommunity'
import { AdminPayments } from './pages/admin/AdminPayments'
import { AdminProjects } from './pages/admin/AdminProjects'
import { AdminProjectDetailV2 } from './pages/admin/AdminProjectDetailV2'
import { AdminProductivity } from './pages/admin/AdminProductivity'
import { AdminServices } from './pages/admin/AdminServices'
import { AdminQuotes } from './pages/admin/AdminQuotes'
import { AdminQuoteDetail } from './pages/admin/AdminQuoteDetail'
import { AdminTeam } from './pages/admin/AdminTeam'
import { AdminAnnouncements } from './pages/admin/AdminAnnouncements'
import { AdminCustomerDetailV2 } from './pages/admin/AdminCustomerDetailV2'
import { AdminOrderDetail } from './pages/admin/AdminOrderDetail'
import { AdminCategories } from './pages/admin/AdminCategories'
import { AdminFilesV2 } from './pages/admin/AdminFilesV2'
import { AdminAboutPortfolio } from './pages/admin/AdminAboutPortfolio'
import { AdminCRM } from './pages/admin/AdminCRM'
import { AdminReports } from './pages/admin/AdminReports'
import { AdminAudit } from './pages/admin/AdminAudit'
import { AdminSettings } from './pages/admin/AdminSettings'
import { AdminPermissionGate } from './components/admin/AdminPermissionGate'

// Placeholder for unbuilt pages
function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center px-6">
      <div className="text-4xl mb-4">🚧</div>
      <h2 className="text-xl font-bold mb-2" style={{ color: '#f0f0f2' }}>{title}</h2>
      <p className="text-sm" style={{ color: '#6b6b78' }}>Página em desenvolvimento. Em breve disponível.</p>
    </div>
  )
}

function AuthenticatedCommunity() {
  const { isAuthenticated, isLoading } = useAuth()
  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-[#0a0a0b]"><div className="w-8 h-8 rounded-full border-2 border-[#E30613] border-t-transparent animate-spin" /></div>
  }
  return isAuthenticated ? <CommunityPage /> : <Navigate to="/login" replace />
}

export default function AppV2() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CartProvider>
          <ToastProvider>
            <Routes>
              {/* Public */}
              <Route path="/" element={<HomePage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/cadastro" element={<RegisterPage />} />
              <Route path="/email-confirmado" element={<EmailConfirmedPage />} />
              <Route path="/esqueci-senha" element={<ForgotPasswordPage />} />
              <Route path="/redefinir-senha" element={<ResetPasswordPage />} />
              <Route path="/produtos" element={<ProductsPage />} />
              <Route path="/produtos/:slug" element={<ProductDetailPage />} />
              <Route path="/servicos" element={<Navigate to="/produtos" replace />} />
              <Route path="/servicos/:slug" element={<Navigate to="/produtos" replace />} />
              <Route path="/quem-somos" element={<AboutPage />} />
              <Route path="/portfolio" element={<Navigate to="/quem-somos#portfolio" replace />} />
              <Route path="/portfolio/:slug" element={<Navigate to="/quem-somos#portfolio" replace />} />
              <Route path="/studio" element={<CategoryPage />} />
              <Route path="/design" element={<CategoryPage />} />
              <Route path="/tech" element={<CategoryPage />} />
              <Route path="/comunidade" element={<AuthenticatedCommunity />} />
              <Route path="/sobre" element={<Navigate to="/quem-somos" replace />} />
              <Route path="/contato" element={<PlaceholderPage title="Contato" />} />
              <Route path="/carrinho" element={<CartPage />} />

              {/* Customer portal */}
              <Route path="/app" element={<CustomerLayoutV2 />}>
                <Route index element={<Navigate to="/app/dashboard" replace />} />
                <Route path="dashboard" element={<DashboardPage />} />
                <Route path="perfil" element={<ProfilePage />} />
                <Route path="pedidos" element={<OrdersPage />} />
                <Route path="pedidos/:id" element={<OrderDetailPage />} />
                <Route path="servicos" element={<CustomerServicesPage />} />
                <Route path="orcamentos" element={<QuotesPage />} />
                <Route path="orcamentos/:id" element={<QuoteDetailPage />} />
                <Route path="pagamentos" element={<PaymentsPage />} />
                <Route path="conversas" element={<ConversationsPage />} />
                <Route path="conversas/:id" element={<ConversationsPage />} />
                <Route path="arquivos" element={<FilesPage />} />
                <Route path="notificacoes" element={<NotificationsPage />} />
                <Route path="projetos" element={<ProjectsPage />} />
                <Route path="projetos/:id" element={<ProjectsPage />} />
                <Route path="comunicados" element={<AnnouncementsPage />} />
                <Route path="configuracoes" element={<CustomerSettings />} />
              </Route>

              {/* Admin panel */}
              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<AdminDashboard />} />
                <Route path="clientes" element={<AdminPermissionGate permission="customers.view"><AdminCustomers /></AdminPermissionGate>} />
                <Route path="crm" element={<AdminPermissionGate permission={['customers.view','customers.manage']}><AdminCRM /></AdminPermissionGate>} />
                <Route path="clientes/:id" element={<AdminPermissionGate permission="customers.view"><AdminCustomerDetailV2 /></AdminPermissionGate>} />
                <Route path="produtos" element={<AdminPermissionGate permission={['catalog.view','catalog.manage']}><AdminProducts /></AdminPermissionGate>} />
                <Route path="categorias" element={<AdminPermissionGate permission={['catalog.view','catalog.manage']}><AdminCategories /></AdminPermissionGate>} />
                <Route path="servicos" element={<AdminPermissionGate permission={['catalog.view','catalog.manage']}><AdminServices /></AdminPermissionGate>} />
                <Route path="pedidos" element={<AdminPermissionGate permission={['sales.view','sales.manage']}><AdminOrders /></AdminPermissionGate>} />
                <Route path="pedidos/:id" element={<AdminPermissionGate permission={['sales.view','sales.manage']}><AdminOrderDetail /></AdminPermissionGate>} />
                <Route path="orcamentos" element={<AdminPermissionGate permission={['quotes.view','quotes.manage']}><AdminQuotes /></AdminPermissionGate>} />
                <Route path="orcamentos/:id" element={<AdminPermissionGate permission={['quotes.view','quotes.manage']}><AdminQuoteDetail /></AdminPermissionGate>} />
                <Route path="pagamentos" element={<AdminPermissionGate permission={['payments.view','payments.manage']}><AdminPayments /></AdminPermissionGate>} />
                <Route path="conversas" element={<AdminPermissionGate permission={['conversations.access','conversations.view_all']}><AdminConversations /></AdminPermissionGate>} />
                <Route path="arquivos" element={<AdminPermissionGate permission={['files.view','files.manage']}><AdminFilesV2 /></AdminPermissionGate>} />
                <Route path="portfolio" element={<AdminPermissionGate permission="site.manage"><AdminAboutPortfolio /></AdminPermissionGate>} />
                <Route path="comunidade" element={<AdminPermissionGate permission="community.manage"><AdminCommunity /></AdminPermissionGate>} />
                <Route path="notificacoes" element={<NotificationsPage />} />
                <Route path="projetos" element={<AdminPermissionGate permission={['projects.view','projects.manage']}><AdminProjects /></AdminPermissionGate>} />
                <Route path="projetos/:id" element={<AdminPermissionGate permission={['projects.view','projects.manage']}><AdminProjectDetailV2 /></AdminPermissionGate>} />
                <Route path="produtividade" element={<AdminPermissionGate permission={['projects.view','projects.manage']}><AdminProductivity /></AdminPermissionGate>} />
                <Route path="comunicados" element={<AdminPermissionGate permission="community.manage"><AdminAnnouncements /></AdminPermissionGate>} />
                <Route path="equipe" element={<AdminPermissionGate adminOnly><AdminTeam /></AdminPermissionGate>} />
                <Route path="site" element={<AdminPermissionGate permission="site.manage"><AdminSiteSettings /></AdminPermissionGate>} />
                <Route path="configuracoes" element={<AdminPermissionGate adminOnly><AdminSettings /></AdminPermissionGate>} />
                <Route path="auditoria" element={<AdminPermissionGate adminOnly><AdminAudit /></AdminPermissionGate>} />
                <Route path="relatorios" element={<AdminPermissionGate permission="reports.view"><AdminReports /></AdminPermissionGate>} />
              </Route>

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </ToastProvider>
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
