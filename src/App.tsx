import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { CartProvider } from './contexts/CartContext'
import { ToastProvider } from './contexts/ToastContext'

// Layouts
import { CustomerLayout } from './layouts/CustomerLayout'
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
import { PortfolioPage } from './pages/public/PortfolioPage'
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
import { AdminProjectDetail } from './pages/admin/AdminProjectDetail'
import { AdminProductivity } from './pages/admin/AdminProductivity'
import { AdminServices } from './pages/admin/AdminServices'
import { AdminQuotes } from './pages/admin/AdminQuotes'
import { AdminQuoteDetail } from './pages/admin/AdminQuoteDetail'
import { AdminTeam } from './pages/admin/AdminTeam'
import { AdminAnnouncements } from './pages/admin/AdminAnnouncements'
import { AdminCustomerDetail } from './pages/admin/AdminCustomerDetail'
import { AdminOrderDetail } from './pages/admin/AdminOrderDetail'
import { AdminCategories } from './pages/admin/AdminCategories'
import { AdminFiles } from './pages/admin/AdminFiles'

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
              <Route path="/portfolio" element={<PortfolioPage />} />
              <Route path="/portfolio/:slug" element={<PlaceholderPage title="Projeto do Portfólio" />} />
              <Route path="/studio" element={<CategoryPage />} />
              <Route path="/design" element={<CategoryPage />} />
              <Route path="/tech" element={<CategoryPage />} />
              <Route path="/comunidade" element={<CommunityPage />} />
              <Route path="/sobre" element={<PlaceholderPage title="Sobre a Play Moments" />} />
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
                <Route path="configuracoes" element={<PlaceholderPage title="Configurações da Conta" />} />
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
                <Route path="portfolio" element={<PlaceholderPage title="Portfólio (Admin)" />} />
                <Route path="comunidade" element={<AdminCommunity />} />
                <Route path="notificacoes" element={<NotificationsPage />} />
                <Route path="projetos" element={<AdminProjects />} />
                <Route path="projetos/:id" element={<AdminProjectDetail />} />
                <Route path="produtividade" element={<AdminProductivity />} />
                <Route path="comunicados" element={<AdminAnnouncements />} />
                <Route path="equipe" element={<AdminTeam />} />
                <Route path="site" element={<AdminSiteSettings />} />
                <Route path="configuracoes" element={<PlaceholderPage title="Configurações (Admin)" />} />
                <Route path="auditoria" element={<PlaceholderPage title="Auditoria" />} />
                <Route path="relatorios" element={<PlaceholderPage title="Relatórios" />} />
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
