import { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'

export function ProfilePage() {
  const { user } = useAuth()
  const toast = useToast()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: user?.name ?? '',
    lastName: user?.lastName ?? '',
    email: user?.email ?? '',
    phone: user?.phone ?? '',
    company: user?.company ?? '',
  })

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }))

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    // TODO: call profileApi.update() when backend ready
    await new Promise(r => setTimeout(r, 800))
    toast('Perfil atualizado com sucesso!', 'success')
    setLoading(false)
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: '#f0f0f2' }}>Meu Perfil</h1>
        <p className="text-sm" style={{ color: '#6b6b78' }}>Gerencie seus dados pessoais</p>
      </div>

      <div className="max-w-xl">
        {/* Avatar */}
        <div className="flex items-center gap-5 mb-8 p-5 rounded-2xl"
          style={{ background: '#141416', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-4xl font-bold"
            style={{ background: 'linear-gradient(135deg, #E30613, #ff4d6d)', color: '#fff' }}>
            {user?.name?.charAt(0) ?? '?'}
          </div>
          <div>
            <p className="font-bold text-lg" style={{ color: '#f0f0f2' }}>{user?.name} {user?.lastName}</p>
            <p className="text-sm" style={{ color: '#6b6b78' }}>{user?.email}</p>
            <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-semibold"
              style={{ background: 'rgba(227,6,19,0.12)', color: '#ff6b7a', border: '1px solid rgba(227,6,19,0.3)' }}>
              {user?.role === 'customer' ? 'Cliente' : user?.role}
            </span>
          </div>
        </div>

        <form onSubmit={handleSave} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Nome" value={form.name} onChange={set('name')} />
            <Input label="Sobrenome" value={form.lastName} onChange={set('lastName')} />
          </div>
          <Input label="E-mail" type="email" value={form.email} onChange={set('email')} />
          <Input label="Telefone" type="tel" value={form.phone} onChange={set('phone')} placeholder="(11) 99999-9999" />
          <Input label="Empresa (opcional)" value={form.company} onChange={set('company')} />

          <div className="pt-2">
            <Button type="submit" loading={loading}>Salvar alterações</Button>
          </div>
        </form>
      </div>
    </div>
  )
}
