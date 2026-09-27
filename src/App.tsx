import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { CartProvider } from './contexts/CartContext'
import { ToastProvider } from './contexts/ToastContext'

// Route-level code splitting
const CustomerLayout = lazy(() => import('./layouts/CustomerLayoutV2').then(m => ({ default: m.CustomerLayoutV2 })))
const AdminLayout = lazy(() => import('./layouts/AdminLayout').then(m => ({ default: m.AdminLayout })))

const HomePage = lazy(() => import('./pages/public/HomePage').then(m => ({ default: m.HomePage })))
const LoginPage = lazy(() => import('./pages/public/LoginPage').then(m => ({ default: m.LoginPage })))
const RegisterPage = lazy(() => import('./pages/public/RegisterPage').then(m => ({ default: m.RegisterPage })))
const EmailConfirmedPage = lazy(() => import('./pages/public/EmailConfirmedPage').then(m => ({ default: m.EmailConfirmedPage })))
const ForgotPasswordPage = lazy(() => import('./pages/public/ForgotPasswordPage').then(m => ({ default: m.ForgotPasswordPage })))
const ResetPasswordPage = lazy(() => import('./pages/public/ResetPasswordPage').then(m => ({ default: m.ResetPasswordPage })))
const CartPage = lazy(() => import('./pages/public/CartPage').then(m => ({ default: m.CartPage })))
const CommunityPage = lazy(() => import('./pages/public/CommunityPage').then(m => ({ default: m.CommunityPage })))
const ProductsPage = lazy(() => import('./pages/public/ProductsPage').then(m => ({ default: m.ProductsPage })))
const ProductDetailPage = lazy(() => import('./pages/public/ProductDetailPage').then(m => ({ default: m.ProductDetailPage })))
const AboutPage = lazy(() => import('./pages/public/AboutPage').then(m => ({ default: m.AboutPage })))
const CategoryPage = lazy(() => import('./pages/public/CategoryPage').then(m => ({ default: m.CategoryPage })))

const DashboardPage = lazy(() => import('./pages/customer/DashboardPage').then(m => ({ default: m.DashboardPage })))
const ProfilePage = lazy(() => import('./pages/customer/ProfilePage').then(m => ({ default: m.ProfilePage })))
const OrdersPage = lazy(() => import('./pages/customer/OrdersPage').then(m => ({ default: m.OrdersPage })))
const QuotesPage = lazy(() => import('./pages/customer/QuotesPage').then(m => ({ default: m.QuotesPage })))
const ConversationsPage = lazy(() => import('./pages/customer/ConversationsPage').then(m => ({ default: m.ConversationsPage })))
const FilesPage = lazy(() => import('./pages/customer/FilesPage').then(m => ({ default: m.FilesPage })))
const NotificationsPage = lazy(() => import('./pages/customer/NotificationsPage').then(m => ({ default: m.NotificationsPage })))
const PaymentsPage = lazy(() => import('./pages/customer/PaymentsPage').then(m => ({ default: m.PaymentsPage })))
const ProjectsPage = lazy(() => import('./pages/customer/ProjectsPage').then(m => ({ default: m.ProjectsPage })))
const CustomerServicesPage = lazy(() => import('./pages/customer/CustomerServicesPage').then(m => ({ default: m.CustomerServicesPage })))
const AnnouncementsPage = lazy(() => import('./pages/customer/AnnouncementsPage').then(m => ({ default: m.AnnouncementsPage })))
const OrderDetailPage = lazy(() => import('./pages/customer/OrderDetailPage').then(m => ({ default: m.OrderDetailPage })))
const QuoteDetailPage = lazy(() => import('./pages/customer/QuoteDetailPage').then(m => ({ default: m.QuoteDetailPage })))
const CustomerSettings = lazy(() => import('./pages/customer/CustomerSettings').then(m => ({ default: m.CustomerSettings })))

const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard').then(m => ({ default: m.AdminDashboard })))
const AdminCustomers = lazy(() => import('./pages/admin/AdminCustomers').then(m => ({ default: m.AdminCustomers })))
const AdminProducts = lazy(() => import('./pages/admin/AdminProducts').then(m => ({ default: m.AdminProducts })))
const AdminOrders = lazy(() => import('./pages/admin/AdminOrders').then(m => ({ default: m.AdminOrders })))
const AdminConversations = lazy(() => import('./pages/admin/AdminConversations').then(m => ({ default: m.AdminConversations })))
const AdminSiteSettings = lazy(() => import('./pages/admin/AdminSiteSettings').then(m => ({ default: m.AdminSiteSettings })))
const AdminCommunity = lazy(() => import('./pages/admin/AdminCommunity').then(m => ({ default: m.AdminCommunity })))
const AdminPayments = lazy(() => import('./pages/admin/AdminPayments').then(m => ({ default: m.AdminPayments })))
const AdminProjects = lazy(() => import('./pages/admin/AdminProjects').then(m => ({ default: m.AdminProjects })))
const AdminProjectDetail = lazy(() => import('./pages/admin/AdminProjectDetail').then(m => ({ default: m.AdminProjectDetail })))
const AdminProductivity = lazy(() => import('./pages/admin/AdminProductivity').then(m => ({ default: m.AdminProductivity })))
const AdminServices = lazy(() => import('./pages/admin/AdminServices').then(m => ({ default: m.AdminServices })))
const AdminQuotes = lazy(() => import('./pages/admin/AdminQuotes').then(m => ({ default: m.AdminQuotes })))
const AdminQuoteDetail = lazy(() => import('./pages/admin/AdminQuoteDetail').then(m => ({ default: m.AdminQuoteDetail })))
const AdminTeam = lazy(() => import('./pages/admin/AdminTeam').then(m => ({ default: m.AdminTeam })))
const AdminAnnouncements = lazy(() => import('./pages/admin/AdminAnnouncements').then(m => ({ default: m.AdminAnnouncements })))
const AdminCustomerDetail = lazy(() => import('./pages/admin/AdminCustomerDetail').then(m => ({ default: m.AdminCustomerDetail })))
const AdminOrderDetail = lazy(() => import('./pages/admin/AdminOrderDetail').then(m => ({ default: m.AdminOrderDetail })))
const AdminCategories = lazy(() => import('./pages/admin/AdminCategories').then(m => ({ default: m.AdminCategories })))
const AdminFiles = lazy(() => import('./pages/admin/AdminFiles').then(m => ({ default: m.AdminFiles })))
const AdminAboutPortfolio = lazy(() => import('./pages/admin/AdminAboutPortfolio').then(m => ({ default: m.AdminAboutPortfolio })))
const AdminSettings = lazy(() => import('./pages/admin/AdminSettings').then(m => ({ default: m.AdminSettings })))
const AdminAudit = lazy(() => import('./pages/admin/AdminAudit').then(m => ({ default: m.AdminAudit })))
const AdminReports = lazy(() => import('./pages/admin/AdminReports').then(m => ({ default: m.AdminReports })))

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

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CartProvider>
          <ToastProvider>
            <Suspense fallback={<div className="min-h-[50vh] flex items-center justify-center"><div className="w-8 h-8 rounded-full border-2 border-[#E30613] border-t-transparent animate-spin"/></div>}>
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
              <Route path="/comunidade" element={<CommunityPage />} />
              <Route path="/sobre" element={<Navigate to="/quem-somos" replace />} />
              <Route path="/contato" element={<PlaceholderPage title="Contato" />} />
              <Route path="/carrinho" element={<CartPage />} />

              {/* Customer portal */}
              <Route path="/app" element={<CustomerLayout />}>
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
                <Route path="clientes" element={<AdminCustomers />} />
                <Route path="clientes/:id" element={<AdminCustomerDetail />} />
                <Route path="produtos" element={<AdminProducts />} />
                <Route path="categorias" element={<AdminCategories />} />
                <Route path="servicos" element={<AdminServices />} />
                <Route path="pedidos" element={<AdminOrders />} />
                <Route path="pedidos/:id" element={<AdminOrderDetail />} />
                <Route path="orcamentos" element={<AdminQuotes />} />
                <Route path="orcamentos/:id" element={<AdminQuoteDetail />} />
                <Route path="pagamentos" element={<AdminPayments />} />
                <Route path="conversas" element={<AdminConversations />} />
                <Route path="arquivos" element={<AdminFiles />} />
                <Route path="portfolio" element={<AdminAboutPortfolio />} />
                <Route path="comunidade" element={<AdminCommunity />} />
                <Route path="notificacoes" element={<NotificationsPage />} />
                <Route path="projetos" element={<AdminProjects />} />
                <Route path="projetos/:id" element={<AdminProjectDetail />} />
                <Route path="produtividade" element={<AdminProductivity />} />
                <Route path="comunicados" element={<AdminAnnouncements />} />
                <Route path="equipe" element={<AdminTeam />} />
                <Route path="site" element={<AdminSiteSettings />} />
                <Route path="configuracoes" element={<AdminSettings />} />
                <Route path="auditoria" element={<AdminAudit />} />
                <Route path="relatorios" element={<AdminReports />} />
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
