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
import { CommunityPage } from './pages/public/CommunityPage'
import { ProductsPage } from './pages/public/ProductsPage'
import { ProductDetailPage } from './pages/public/ProductDetailPage'
import { ServicesPage } from './pages/public/ServicesPage'
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

// Admin panel
import { AdminDashboard } from './pages/admin/AdminDashboard'
import { AdminCustomers } from './pages/admin/AdminCustomers'
import { AdminProducts } from './pages/admin/AdminProducts'
import { AdminOrders } from './pages/admin/AdminOrders'
import { AdminConversations } from './pages/admin/AdminConversations'
import { AdminSiteSettings } from './pages/admin/AdminSiteSettings'
import { AdminCommunity } from './pages/admin/AdminCommunity'

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
              <Route path="/esqueci-senha" element={<PlaceholderPage title="Recuperar Senha" />} />
              <Route path="/produtos" element={<ProductsPage />} />
              <Route path="/produtos/:slug" element={<ProductDetailPage />} />
              <Route path="/servicos" element={<ServicesPage />} />
              <Route path="/servicos/:slug" element={<PlaceholderPage title="Detalhe do Serviço" />} />
              <Route path="/portfolio" element={<PortfolioPage />} />
              <Route path="/portfolio/:slug" element={<PlaceholderPage title="Projeto do Portfólio" />} />
              <Route path="/studio" element={<CategoryPage />} />
              <Route path="/design" element={<CategoryPage />} />
              <Route path="/tech" element={<CategoryPage />} />
              <Route path="/comunidade" element={<CommunityPage />} />
              <Route path="/sobre" element={<PlaceholderPage title="Sobre a Play Moments" />} />
              <Route path="/contato" element={<PlaceholderPage title="Contato" />} />
              <Route path="/carrinho" element={<PlaceholderPage title="Carrinho" />} />

              {/* Customer portal */}
              <Route path="/app" element={<CustomerLayout />}>
                <Route index element={<Navigate to="/app/dashboard" replace />} />
                <Route path="dashboard" element={<DashboardPage />} />
                <Route path="perfil" element={<ProfilePage />} />
                <Route path="pedidos" element={<OrdersPage />} />
                <Route path="pedidos/:id" element={<PlaceholderPage title="Detalhe do Pedido" />} />
                <Route path="servicos" element={<PlaceholderPage title="Meus Serviços" />} />
                <Route path="orcamentos" element={<QuotesPage />} />
                <Route path="orcamentos/:id" element={<PlaceholderPage title="Detalhe do Orçamento" />} />
                <Route path="pagamentos" element={<PlaceholderPage title="Pagamentos" />} />
                <Route path="conversas" element={<ConversationsPage />} />
                <Route path="conversas/:id" element={<ConversationsPage />} />
                <Route path="arquivos" element={<FilesPage />} />
                <Route path="notificacoes" element={<NotificationsPage />} />
                <Route path="comunicados" element={<PlaceholderPage title="Comunicados" />} />
                <Route path="configuracoes" element={<PlaceholderPage title="Configurações da Conta" />} />
              </Route>

              {/* Admin panel */}
              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<AdminDashboard />} />
                <Route path="clientes" element={<AdminCustomers />} />
                <Route path="clientes/:id" element={<PlaceholderPage title="Perfil do Cliente" />} />
                <Route path="produtos" element={<AdminProducts />} />
                <Route path="categorias" element={<PlaceholderPage title="Categorias" />} />
                <Route path="servicos" element={<PlaceholderPage title="Serviços (Admin)" />} />
                <Route path="pedidos" element={<AdminOrders />} />
                <Route path="pedidos/:id" element={<PlaceholderPage title="Detalhe do Pedido (Admin)" />} />
                <Route path="orcamentos" element={<PlaceholderPage title="Orçamentos (Admin)" />} />
                <Route path="pagamentos" element={<PlaceholderPage title="Pagamentos (Admin)" />} />
                <Route path="conversas" element={<AdminConversations />} />
                <Route path="arquivos" element={<PlaceholderPage title="Arquivos (Admin)" />} />
                <Route path="portfolio" element={<PlaceholderPage title="Portfólio (Admin)" />} />
                <Route path="comunidade" element={<AdminCommunity />} />
                <Route path="notificacoes" element={<PlaceholderPage title="Notificações (Admin)" />} />
                <Route path="equipe" element={<PlaceholderPage title="Equipe" />} />
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
