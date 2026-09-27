import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { CartProvider } from './contexts/CartContext'
import { ToastProvider } from './contexts/ToastContext'
import { useAuth } from './contexts/AuthContext'

// Route-level code splitting keeps public, customer and admin screens out of the initial bundle.
const CustomerLayoutV2 = lazy(() => import('./layouts/CustomerLayoutV2').then(m => ({ default:m.CustomerLayoutV2 })))
const AdminLayout = lazy(() => import('./layouts/AdminLayout').then(m => ({ default:m.AdminLayout })))
const HomePage = lazy(() => import('./pages/public/HomePage').then(m => ({ default:m.HomePage })))
const LoginPage = lazy(() => import('./pages/public/LoginPage').then(m => ({ default:m.LoginPage })))
const RegisterPage = lazy(() => import('./pages/public/RegisterPage').then(m => ({ default:m.RegisterPage })))
const EmailConfirmedPage = lazy(() => import('./pages/public/EmailConfirmedPage').then(m => ({ default:m.EmailConfirmedPage })))
const ForgotPasswordPage = lazy(() => import('./pages/public/ForgotPasswordPage').then(m => ({ default:m.ForgotPasswordPage })))
const ResetPasswordPage = lazy(() => import('./pages/public/ResetPasswordPage').then(m => ({ default:m.ResetPasswordPage })))
const CartPage = lazy(() => import('./pages/public/CartPage').then(m => ({ default:m.CartPage })))
const CommunityPage = lazy(() => import('./pages/public/CommunityPage').then(m => ({ default:m.CommunityPage })))
const ProductsPage = lazy(() => import('./pages/public/ProductsPage').then(m => ({ default:m.ProductsPage })))
const ProductDetailPage = lazy(() => import('./pages/public/ProductDetailPage').then(m => ({ default:m.ProductDetailPage })))
const ServicesPage = lazy(() => import('./pages/public/ServicesPage').then(m => ({ default:m.ServicesPage })))
const ServiceDetailPage = lazy(() => import('./pages/public/ServiceDetailPage').then(m => ({ default:m.ServiceDetailPage })))
const ContactPage = lazy(() => import('./pages/public/ContactPage').then(m => ({ default:m.ContactPage })))
const AboutPage = lazy(() => import('./pages/public/AboutPage').then(m => ({ default:m.AboutPage })))
const CategoryPage = lazy(() => import('./pages/public/CategoryPage').then(m => ({ default:m.CategoryPage })))
const DashboardPage = lazy(() => import('./pages/customer/DashboardPage').then(m => ({ default:m.DashboardPage })))
const ProfilePage = lazy(() => import('./pages/customer/ProfilePage').then(m => ({ default:m.ProfilePage })))
const OrdersPage = lazy(() => import('./pages/customer/OrdersPage').then(m => ({ default:m.OrdersPage })))
const QuotesPage = lazy(() => import('./pages/customer/QuotesPage').then(m => ({ default:m.QuotesPage })))
const ConversationsPage = lazy(() => import('./pages/customer/ConversationsPage').then(m => ({ default:m.ConversationsPage })))
const FilesPage = lazy(() => import('./pages/customer/FilesPage').then(m => ({ default:m.FilesPage })))
const NotificationsPage = lazy(() => import('./pages/customer/NotificationsPage').then(m => ({ default:m.NotificationsPage })))
const PaymentsPage = lazy(() => import('./pages/customer/PaymentsPage').then(m => ({ default:m.PaymentsPage })))
const ProjectsPage = lazy(() => import('./pages/customer/ProjectsPage').then(m => ({ default:m.ProjectsPage })))
const CustomerServicesPage = lazy(() => import('./pages/customer/CustomerServicesPage').then(m => ({ default:m.CustomerServicesPage })))
const AnnouncementsPage = lazy(() => import('./pages/customer/AnnouncementsPage').then(m => ({ default:m.AnnouncementsPage })))
const OrderDetailPage = lazy(() => import('./pages/customer/OrderDetailPage').then(m => ({ default:m.OrderDetailPage })))
const QuoteDetailPage = lazy(() => import('./pages/customer/QuoteDetailPage').then(m => ({ default:m.QuoteDetailPage })))
const CustomerSettings = lazy(() => import('./pages/customer/CustomerSettings').then(m => ({ default:m.CustomerSettings })))
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard').then(m => ({ default:m.AdminDashboard })))
const AdminCustomers = lazy(() => import('./pages/admin/AdminCustomers').then(m => ({ default:m.AdminCustomers })))
const AdminProducts = lazy(() => import('./pages/admin/AdminProducts').then(m => ({ default:m.AdminProducts })))
const AdminOrders = lazy(() => import('./pages/admin/AdminOrders').then(m => ({ default:m.AdminOrders })))
const AdminConversations = lazy(() => import('./pages/admin/AdminConversations').then(m => ({ default:m.AdminConversations })))
const AdminSiteSettings = lazy(() => import('./pages/admin/AdminSiteSettings').then(m => ({ default:m.AdminSiteSettings })))
const AdminCommunity = lazy(() => import('./pages/admin/AdminCommunity').then(m => ({ default:m.AdminCommunity })))
const AdminPayments = lazy(() => import('./pages/admin/AdminPayments').then(m => ({ default:m.AdminPayments })))
const AdminProjects = lazy(() => import('./pages/admin/AdminProjects').then(m => ({ default:m.AdminProjects })))
const AdminProjectDetailV2 = lazy(() => import('./pages/admin/AdminProjectDetailV2').then(m => ({ default:m.AdminProjectDetailV2 })))
const AdminProductivity = lazy(() => import('./pages/admin/AdminProductivity').then(m => ({ default:m.AdminProductivity })))
const AdminServices = lazy(() => import('./pages/admin/AdminServices').then(m => ({ default:m.AdminServices })))
const AdminQuotes = lazy(() => import('./pages/admin/AdminQuotes').then(m => ({ default:m.AdminQuotes })))
const AdminQuoteDetail = lazy(() => import('./pages/admin/AdminQuoteDetail').then(m => ({ default:m.AdminQuoteDetail })))
const AdminTeam = lazy(() => import('./pages/admin/AdminTeam').then(m => ({ default:m.AdminTeam })))
const AdminAnnouncements = lazy(() => import('./pages/admin/AdminAnnouncements').then(m => ({ default:m.AdminAnnouncements })))
const AdminCustomerDetailV2 = lazy(() => import('./pages/admin/AdminCustomerDetailV2').then(m => ({ default:m.AdminCustomerDetailV2 })))
const AdminOrderDetail = lazy(() => import('./pages/admin/AdminOrderDetail').then(m => ({ default:m.AdminOrderDetail })))
const AdminCategories = lazy(() => import('./pages/admin/AdminCategories').then(m => ({ default:m.AdminCategories })))
const AdminFilesV2 = lazy(() => import('./pages/admin/AdminFilesV2').then(m => ({ default:m.AdminFilesV2 })))
const AdminAboutPortfolio = lazy(() => import('./pages/admin/AdminAboutPortfolio').then(m => ({ default:m.AdminAboutPortfolio })))
const AdminCRM = lazy(() => import('./pages/admin/AdminCRM').then(m => ({ default:m.AdminCRM })))
const AdminReports = lazy(() => import('./pages/admin/AdminReports').then(m => ({ default:m.AdminReports })))
const AdminAudit = lazy(() => import('./pages/admin/AdminAudit').then(m => ({ default:m.AdminAudit })))
const AdminSettings = lazy(() => import('./pages/admin/AdminSettings').then(m => ({ default:m.AdminSettings })))
const AdminPermissionGate = lazy(() => import('./components/admin/AdminPermissionGate').then(m => ({ default:m.AdminPermissionGate })))

function RouteFallback(){
  return <div className="min-h-[35vh] flex items-center justify-center"><div className="w-8 h-8 rounded-full border-2 border-[#E30613] border-t-transparent animate-spin" /></div>
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
            <Suspense fallback={<RouteFallback />}>
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
              <Route path="/servicos" element={<ServicesPage />} />
              <Route path="/servicos/:slug" element={<ServiceDetailPage />} />
              <Route path="/quem-somos" element={<AboutPage />} />
              <Route path="/portfolio" element={<Navigate to="/quem-somos#portfolio" replace />} />
              <Route path="/portfolio/:slug" element={<Navigate to="/quem-somos#portfolio" replace />} />
              <Route path="/studio" element={<CategoryPage />} />
              <Route path="/design" element={<CategoryPage />} />
              <Route path="/tech" element={<CategoryPage />} />
              <Route path="/comunidade" element={<AuthenticatedCommunity />} />
              <Route path="/sobre" element={<Navigate to="/quem-somos" replace />} />
              <Route path="/contato" element={<ContactPage />} />
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
                <Route path="notificacoes" element={<AdminPermissionGate><NotificationsPage /></AdminPermissionGate>} />
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
            </Suspense>
          </ToastProvider>
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
