import { useEffect, useMemo, useState } from 'react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { useToast } from '../../contexts/ToastContext'
import {
  archiveProduct,
  createProduct,
  deleteProductImage,
  listAdminProducts,
  listCategories,
  reorderProductImages,
  setProductCover,
  updateProduct,
  uploadProductImage,
  type CatalogProductRow,
  type ProductImageRow,
  type PublicCatalogProduct,
  type CommercialMode,
  type ProductCategoryRow,
  type ProductInput,
  type ProductStatus,
  type ProductType,
} from '../../services/catalog'

interface FormState {
  name: string
  sku: string
  shortDescription: string
  description: string
  categoryId: string
  productType: ProductType
  commercialMode: CommercialMode
  salePrice: string
  promotionalPrice: string
  rentalDailyPrice: string
  stock: string
  featured: boolean
  active: boolean
  status: ProductStatus
}

const EMPTY_FORM: FormState = {
  name: '',
  sku: '',
  shortDescription: '',
  description: '',
  categoryId: '',
  productType: 'physical',
  commercialMode: 'sale',
  salePrice: '',
  promotionalPrice: '',
  rentalDailyPrice: '',
  stock: '0',
  featured: false,
  active: true,
  status: 'draft',
}

function formatPrice(cents: number | null) {
  if (cents === null) return '—'

  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100)
}

function centsToInput(cents: number | null) {
  if (cents === null) return ''

  return (cents / 100).toFixed(2).replace('.', ',')
}

function inputToCents(value: string) {
  const trimmed = value.trim()

  if (!trimmed) return null

  let normalized = trimmed

  if (normalized.includes(',')) {
    normalized = normalized.replace(/\./g, '').replace(',', '.')
  }

  const number = Number(normalized)

  if (!Number.isFinite(number) || number < 0) {
    throw new Error('Informe um valor válido.')
  }

  return Math.round(number * 100)
}

function createSlug(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function productToForm(product: CatalogProductRow): FormState {
  return {
    name: product.name,
    sku: product.sku ?? '',
    shortDescription: product.short_description ?? '',
    description: product.description,
    categoryId: product.category_id ?? '',
    productType: product.product_type,
    commercialMode: product.commercial_mode,
    salePrice: centsToInput(product.sale_price),
    promotionalPrice: centsToInput(product.promotional_price),
    rentalDailyPrice: centsToInput(product.rental_daily_price),
    stock: String(product.stock),
    featured: product.featured,
    active: product.active,
    status: product.status,
  }
}

export function AdminProducts() {
  const toast = useToast()

  const [products, setProducts] = useState<PublicCatalogProduct[]>([])
  const [categories, setCategories] = useState<ProductCategoryRow[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<PublicCatalogProduct | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [pendingImages, setPendingImages] = useState<File[]>([])
  const [mediaBusy, setMediaBusy] = useState(false)

  async function loadData() {
    try {
      setLoading(true)

      const [productsData, categoriesData] = await Promise.all([
        listAdminProducts(),
        listCategories(),
      ])

      setProducts(productsData)
      setCategories(categoriesData)
    } catch (error) {
      console.error(error)
      toast('Não foi possível carregar os produtos.', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

  const filtered = useMemo(() => {
    const term = search.toLowerCase().trim()

    if (!term) return products

    return products.filter(product =>
      product.name.toLowerCase().includes(term) ||
      (product.sku ?? '').toLowerCase().includes(term)
    )
  }, [products, search])

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setPendingImages([])
    setPendingImages([])
    setModalOpen(true)
  }

  function openEdit(product: PublicCatalogProduct) {
    setEditing(product)
    setForm(productToForm(product))
    setPendingImages([])
    setModalOpen(true)
  }

  function closeModal() {
    if (saving) return

    setModalOpen(false)
    setEditing(null)
    setForm(EMPTY_FORM)
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()

    if (!form.name.trim()) {
      toast('Informe o nome do produto.', 'warning')
      return
    }

    if (!form.description.trim()) {
      toast('Informe a descrição do produto.', 'warning')
      return
    }

    try {
      setSaving(true)

      const salePrice = inputToCents(form.salePrice)
      const promotionalPrice = inputToCents(form.promotionalPrice)
      const rentalDailyPrice = inputToCents(form.rentalDailyPrice)

      if (
        (form.commercialMode === 'sale' ||
          form.commercialMode === 'sale_and_rental') &&
        salePrice === null
      ) {
        throw new Error('Informe o preço de venda.')
      }

      if (
        (form.commercialMode === 'rental' ||
          form.commercialMode === 'sale_and_rental') &&
        rentalDailyPrice === null
      ) {
        throw new Error('Informe o valor da diária.')
      }

      const stock = Number(form.stock)

      if (!Number.isInteger(stock) || stock < 0) {
        throw new Error('Informe um estoque válido.')
      }

      const input: ProductInput = {
        name: form.name.trim(),
        slug: editing?.slug ?? createSlug(form.name),
        sku: form.sku.trim() || null,
        short_description: form.shortDescription.trim() || null,
        description: form.description.trim(),
        category_id: form.categoryId || null,
        product_type: form.productType,
        commercial_mode: form.commercialMode,
        sale_price: salePrice,
        promotional_price: promotionalPrice,
        rental_daily_price: rentalDailyPrice,
        stock,
        featured: form.featured,
        active: form.active,
        status: form.status,
      }

      const savedProduct = editing
        ? await updateProduct(editing.id, input)
        : await createProduct(input)

      const existingCount = editing?.product_images?.length ?? 0
      if (existingCount + pendingImages.length > 10) {
        throw new Error('A galeria aceita no máximo 10 imagens.')
      }

      for (let index = 0; index < pendingImages.length; index += 1) {
        await uploadProductImage(
          savedProduct.id,
          pendingImages[index],
          existingCount + index,
          existingCount === 0 && index === 0,
        )
      }

      toast(editing ? 'Produto atualizado com sucesso.' : 'Produto criado com sucesso.', 'success')
      closeModal()
      await loadData()
    } catch (error) {
      console.error(error)

      const message =
        error instanceof Error
          ? error.message
          : 'Não foi possível salvar o produto.'

      toast(message, 'error')
    } finally {
      setSaving(false)
    }
  }

  function addPendingImages(files: FileList | null) {
    if (!files) return
    const incoming = Array.from(files)
    const currentCount = (editing?.product_images?.length ?? 0) + pendingImages.length
    const available = Math.max(0, 10 - currentCount)
    if (incoming.length > available) {
      toast('A galeria aceita no máximo 10 imagens.', 'warning')
    }
    setPendingImages(current => [...current, ...incoming.slice(0, available)])
  }

  async function refreshEditingMedia(productId: string) {
    const data = await listAdminProducts()
    setProducts(data)
    const updated = data.find(product => product.id === productId) ?? null
    setEditing(updated)
  }

  async function handleSetCover(image: ProductImageRow) {
    if (!editing) return
    try {
      setMediaBusy(true)
      await setProductCover(editing.id, image.id)
      await refreshEditingMedia(editing.id)
      toast('Capa atualizada.', 'success')
    } catch (error) {
      console.error(error)
      toast('Não foi possível alterar a capa.', 'error')
    } finally {
      setMediaBusy(false)
    }
  }

  async function handleDeleteImage(image: ProductImageRow) {
    if (!editing || !window.confirm('Excluir esta imagem da galeria?')) return
    try {
      setMediaBusy(true)
      const wasCover = image.is_cover
      await deleteProductImage(image)
      await refreshEditingMedia(editing.id)
      if (wasCover) {
        const data = await listAdminProducts()
        const updated = data.find(product => product.id === editing.id)
        const next = updated?.product_images?.[0]
        if (next) {
          await setProductCover(editing.id, next.id)
          await refreshEditingMedia(editing.id)
        }
      }
      toast('Imagem removida.', 'success')
    } catch (error) {
      console.error(error)
      toast('Não foi possível excluir a imagem.', 'error')
    } finally {
      setMediaBusy(false)
    }
  }

  async function moveImage(imageId: string, direction: -1 | 1) {
    if (!editing) return
    const current = [...editing.product_images]
    const index = current.findIndex(image => image.id === imageId)
    const target = index + direction
    if (index < 0 || target < 0 || target >= current.length) return
    ;[current[index], current[target]] = [current[target], current[index]]
    try {
      setMediaBusy(true)
      await reorderProductImages(current)
      await refreshEditingMedia(editing.id)
    } catch (error) {
      console.error(error)
      toast('Não foi possível reorganizar a galeria.', 'error')
    } finally {
      setMediaBusy(false)
    }
  }

  async function handleArchive(product: CatalogProductRow) {
    const confirmed = window.confirm(
      `Arquivar o produto "${product.name}"?`
    )

    if (!confirmed) return

    try {
      await archiveProduct(product.id)
      toast('Produto arquivado.', 'success')
      await loadData()
    } catch (error) {
      console.error(error)
      toast('Não foi possível arquivar o produto.', 'error')
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1
            className="text-2xl font-bold"
            style={{ color: '#f0f0f2' }}
          >
            Produtos
          </h1>

          <p
            className="text-sm"
            style={{ color: '#6b6b78' }}
          >
            {products.length} produtos cadastrados
          </p>
        </div>

        <Button onClick={openCreate}>
          + Novo produto
        </Button>
      </div>

      <div className="mb-4">
        <input
          value={search}
          onChange={event => setSearch(event.target.value)}
          placeholder="Buscar por produto ou SKU..."
          className="w-full max-w-sm px-4 py-2.5 rounded-xl text-sm outline-none"
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: '#f0f0f2',
          }}
        />
      </div>

      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: '#141416',
          border: '1px solid rgba(255,255,255,0.07)',
        }}
      >
        <div
          className="px-5 py-3 text-xs font-semibold uppercase tracking-wider border-b"
          style={{
            color: '#6b6b78',
            borderColor: 'rgba(255,255,255,0.05)',
          }}
        >
          <div
            className="grid gap-4"
            style={{
              gridTemplateColumns:
                '2fr 1fr 1fr 80px 110px 150px',
            }}
          >
            <span>Produto</span>
            <span>SKU</span>
            <span>Preço</span>
            <span>Estoque</span>
            <span>Status</span>
            <span>Ações</span>
          </div>
        </div>

        {loading && (
          <div
            className="px-5 py-10 text-center text-sm"
            style={{ color: '#9090a0' }}
          >
            Carregando produtos...
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div
            className="px-5 py-12 text-center"
            style={{ color: '#9090a0' }}
          >
            <p className="font-semibold mb-2">
              Nenhum produto cadastrado.
            </p>

            <p className="text-sm">
              Clique em “+ Novo produto” para criar o primeiro.
            </p>
          </div>
        )}

        {!loading &&
          filtered.map((product, index) => (
            <div
              key={product.id}
              className="grid gap-4 px-5 py-4 items-center hover:bg-white/[0.02]"
              style={{
                gridTemplateColumns:
                  '2fr 1fr 1fr 80px 110px 150px',
                borderBottom:
                  index < filtered.length - 1
                    ? '1px solid rgba(255,255,255,0.05)'
                    : undefined,
              }}
            >
              <div className="flex items-center gap-3">
                <div>
                  <p
                    className="text-sm font-semibold"
                    style={{ color: '#f0f0f2' }}
                  >
                    {product.name}
                  </p>

                  <p
                    className="text-xs mt-1"
                    style={{ color: '#6b6b78' }}
                  >
                    {product.commercial_mode === 'sale'
                      ? 'Venda'
                      : product.commercial_mode === 'rental'
                        ? 'Locação'
                        : 'Venda + Locação'}
                  </p>
                </div>

                {product.featured && (
                  <Badge variant="brand">
                    Destaque
                  </Badge>
                )}
              </div>

              <span
                className="text-sm font-mono"
                style={{ color: '#9090a0' }}
              >
                {product.sku || '—'}
              </span>

              <div>
                <span
                  className="text-sm font-semibold"
                  style={{ color: '#f0f0f2' }}
                >
                  {formatPrice(product.sale_price)}
                </span>

                {product.rental_daily_price !== null && (
                  <p
                    className="text-xs mt-1"
                    style={{ color: '#9090a0' }}
                  >
                    {formatPrice(product.rental_daily_price)}/dia
                  </p>
                )}
              </div>

              <span
                className="text-sm"
                style={{
                  color:
                    product.stock === 0
                      ? '#ff6b7a'
                      : '#f0f0f2',
                }}
              >
                {product.stock}
              </span>

              <Badge
                variant={
                  product.status === 'published'
                    ? 'success'
                    : product.status === 'archived'
                      ? 'danger'
                      : 'default'
                }
              >
                {product.status === 'published'
                  ? 'Publicado'
                  : product.status === 'archived'
                    ? 'Arquivado'
                    : 'Rascunho'}
              </Badge>

              <div className="flex gap-2">
                <button
                  onClick={() => openEdit(product)}
                  className="text-xs px-2 py-1 rounded-lg"
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    color: '#c0c0cc',
                  }}
                >
                  Editar
                </button>

                {product.status !== 'archived' && (
                  <button
                    onClick={() => void handleArchive(product)}
                    className="text-xs px-2 py-1 rounded-lg"
                    style={{
                      background: 'rgba(227,6,19,0.10)',
                      color: '#ff6b7a',
                    }}
                  >
                    Arquivar
                  </button>
                )}
              </div>
            </div>
          ))}
      </div>

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{
            background: 'rgba(0,0,0,0.78)',
          }}
        >
          <div
            className="w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-2xl"
            style={{
              background: '#141416',
              border: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            <div
              className="flex items-center justify-between px-6 py-5 border-b"
              style={{
                borderColor: 'rgba(255,255,255,0.07)',
              }}
            >
              <div>
                <h2
                  className="text-xl font-bold"
                  style={{ color: '#f0f0f2' }}
                >
                  {editing
                    ? 'Editar produto'
                    : 'Novo produto'}
                </h2>

                <p
                  className="text-sm mt-1"
                  style={{ color: '#6b6b78' }}
                >
                  Dados do catálogo Play Moments
                </p>
              </div>

              <button
                onClick={closeModal}
                className="text-xl"
                style={{ color: '#9090a0' }}
              >
                ×
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
              className="p-6 space-y-5"
            >
              <div className="grid md:grid-cols-2 gap-4">
                <Field label="Nome *">
                  <input
                    value={form.name}
                    onChange={event =>
                      setForm(current => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                    className="catalog-input"
                  />
                </Field>

                <Field label="SKU">
                  <input
                    value={form.sku}
                    onChange={event =>
                      setForm(current => ({
                        ...current,
                        sku: event.target.value,
                      }))
                    }
                    className="catalog-input"
                  />
                </Field>
              </div>

              <Field label="Descrição curta">
                <input
                  value={form.shortDescription}
                  onChange={event =>
                    setForm(current => ({
                      ...current,
                      shortDescription: event.target.value,
                    }))
                  }
                  className="catalog-input"
                />
              </Field>

              <Field label="Descrição *">
                <textarea
                  rows={5}
                  value={form.description}
                  onChange={event =>
                    setForm(current => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  className="catalog-input resize-y"
                />
              </Field>

              <div className="grid md:grid-cols-3 gap-4">
                <Field label="Categoria">
                  <select
                    value={form.categoryId}
                    onChange={event =>
                      setForm(current => ({
                        ...current,
                        categoryId: event.target.value,
                      }))
                    }
                    className="catalog-input"
                  >
                    <option value="">
                      Sem categoria
                    </option>

                    {categories.map(category => (
                      <option
                        key={category.id}
                        value={category.id}
                      >
                        {category.name}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Tipo">
                  <select
                    value={form.productType}
                    onChange={event =>
                      setForm(current => ({
                        ...current,
                        productType:
                          event.target.value as ProductType,
                      }))
                    }
                    className="catalog-input"
                  >
                    <option value="physical">
                      Produto físico
                    </option>
                    <option value="equipment">
                      Equipamento
                    </option>
                    <option value="digital">
                      Digital
                    </option>
                    <option value="package">
                      Pacote
                    </option>
                  </select>
                </Field>

                <Field label="Comercialização">
                  <select
                    value={form.commercialMode}
                    onChange={event =>
                      setForm(current => ({
                        ...current,
                        commercialMode:
                          event.target.value as CommercialMode,
                      }))
                    }
                    className="catalog-input"
                  >
                    <option value="sale">
                      Venda
                    </option>
                    <option value="rental">
                      Locação
                    </option>
                    <option value="sale_and_rental">
                      Venda + locação
                    </option>
                  </select>
                </Field>
              </div>

              <div className="grid md:grid-cols-4 gap-4">
                {(form.commercialMode === 'sale' ||
                  form.commercialMode ===
                    'sale_and_rental') && (
                  <>
                    <Field label="Preço de venda (R$)">
                      <input
                        value={form.salePrice}
                        onChange={event =>
                          setForm(current => ({
                            ...current,
                            salePrice:
                              event.target.value,
                          }))
                        }
                        placeholder="1500,00"
                        className="catalog-input"
                      />
                    </Field>

                    <Field label="Preço promocional">
                      <input
                        value={form.promotionalPrice}
                        onChange={event =>
                          setForm(current => ({
                            ...current,
                            promotionalPrice:
                              event.target.value,
                          }))
                        }
                        placeholder="1299,00"
                        className="catalog-input"
                      />
                    </Field>
                  </>
                )}

                {(form.commercialMode === 'rental' ||
                  form.commercialMode ===
                    'sale_and_rental') && (
                  <Field label="Diária (R$)">
                    <input
                      value={form.rentalDailyPrice}
                      onChange={event =>
                        setForm(current => ({
                          ...current,
                          rentalDailyPrice:
                            event.target.value,
                        }))
                      }
                      placeholder="250,00"
                      className="catalog-input"
                    />
                  </Field>
                )}

                <Field label="Estoque">
                  <input
                    type="number"
                    min="0"
                    value={form.stock}
                    onChange={event =>
                      setForm(current => ({
                        ...current,
                        stock: event.target.value,
                      }))
                    }
                    className="catalog-input"
                  />
                </Field>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <Field label="Status">
                  <select
                    value={form.status}
                    onChange={event =>
                      setForm(current => ({
                        ...current,
                        status:
                          event.target.value as ProductStatus,
                      }))
                    }
                    className="catalog-input"
                  >
                    <option value="draft">
                      Rascunho
                    </option>
                    <option value="published">
                      Publicado
                    </option>
                    <option value="archived">
                      Arquivado
                    </option>
                  </select>
                </Field>

                <div className="flex items-end gap-5 pb-2">
                  <label
                    className="flex items-center gap-2 text-sm"
                    style={{ color: '#c0c0cc' }}
                  >
                    <input
                      type="checkbox"
                      checked={form.featured}
                      onChange={event =>
                        setForm(current => ({
                          ...current,
                          featured:
                            event.target.checked,
                        }))
                      }
                    />
                    Destaque
                  </label>

                  <label
                    className="flex items-center gap-2 text-sm"
                    style={{ color: '#c0c0cc' }}
                  >
                    <input
                      type="checkbox"
                      checked={form.active}
                      onChange={event =>
                        setForm(current => ({
                          ...current,
                          active:
                            event.target.checked,
                        }))
                      }
                    />
                    Ativo
                  </label>
                </div>
              </div>

              <div className="pt-5 border-t" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
                <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                  <div>
                    <p className="text-sm font-semibold" style={{ color: '#f0f0f2' }}>Imagens do produto</p>
                    <p className="text-xs mt-1" style={{ color: '#6b6b78' }}>Capa + galeria. Recomendado: 3 a 10 imagens. Máximo: 10.</p>
                  </div>
                  <label className="px-3 py-2 rounded-lg text-xs cursor-pointer" style={{ background: 'rgba(255,255,255,0.07)', color: '#f0f0f2' }}>
                    + Selecionar imagens
                    <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple className="hidden" onChange={event => { addPendingImages(event.target.files); event.currentTarget.value = '' }} />
                  </label>
                </div>

                {editing?.product_images?.length ? (
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-3">
                    {editing.product_images.map((image,index) => (
                      <div key={image.id} className="rounded-xl overflow-hidden border" style={{ borderColor: image.is_cover ? 'rgba(227,6,19,0.7)' : 'rgba(255,255,255,0.08)', background: '#0f0f11' }}>
                        <div className="h-32 bg-black/20">
                          {image.public_url ? <img src={image.public_url} alt={image.alt_text || form.name} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center text-xs text-gray-500">Sem prévia</div>}
                        </div>
                        <div className="p-2">
                          <div className="flex justify-between gap-2 items-center">
                            <span className="text-[11px]" style={{ color: image.is_cover ? '#ff6b7a' : '#9090a0' }}>{image.is_cover ? 'Capa' : 'Imagem '+(index+1)}</span>
                            <div className="flex gap-1">
                              <button type="button" disabled={mediaBusy || index===0} onClick={()=>moveImage(image.id,-1)} className="px-2 py-1 rounded bg-white/5 text-xs disabled:opacity-30">←</button>
                              <button type="button" disabled={mediaBusy || index===editing.product_images.length-1} onClick={()=>moveImage(image.id,1)} className="px-2 py-1 rounded bg-white/5 text-xs disabled:opacity-30">→</button>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-1 mt-2">
                            <button type="button" disabled={mediaBusy || image.is_cover} onClick={()=>handleSetCover(image)} className="px-2 py-1.5 rounded bg-white/5 text-[11px] disabled:opacity-40">Definir capa</button>
                            <button type="button" disabled={mediaBusy} onClick={()=>handleDeleteImage(image)} className="px-2 py-1.5 rounded bg-red-500/10 text-red-300 text-[11px] disabled:opacity-40">Excluir</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : editing ? <p className="text-xs mb-3" style={{ color: '#6b6b78' }}>Este produto ainda não possui imagens.</p> : null}

                {pendingImages.length > 0 && (
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {pendingImages.map((file,index) => (
                      <PendingImagePreview
                        key={file.name+file.size+index}
                        file={file}
                        onRemove={()=>setPendingImages(current=>current.filter((_,i)=>i!==index))}
                      />
                    ))}
                  </div>
                )}
              </div>

              <div
                className="flex justify-end gap-3 pt-5 border-t"
                style={{
                  borderColor:
                    'rgba(255,255,255,0.07)',
                }}
              >
                <Button
                  type="button"
                  variant="secondary"
                  onClick={closeModal}
                  disabled={saving}
                >
                  Cancelar
                </Button>

                <Button
                  type="submit"
                  loading={saving}
                >
                  {editing
                    ? 'Salvar alterações'
                    : 'Criar produto'}
                </Button>
              </div>
            </form>
          </div>

          <style>{`
            .catalog-input {
              width: 100%;
              padding: 10px 12px;
              border-radius: 10px;
              border: 1px solid rgba(255,255,255,0.1);
              background: rgba(255,255,255,0.05);
              color: #f0f0f2;
              outline: none;
              font-size: 14px;
            }

            .catalog-input:focus {
              border-color: rgba(227,6,19,0.7);
            }

            .catalog-input option {
              background: #141416;
              color: #f0f0f2;
            }
          `}</style>
        </div>
      )}
    </div>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span
        className="block text-xs font-semibold mb-2"
        style={{ color: '#9090a0' }}
      >
        {label}
      </span>

      {children}
    </label>
  )
}


function PendingImagePreview({ file, onRemove }: { file: File; onRemove: () => void }) {
  const [preview,setPreview]=useState('')

  useEffect(()=>{
    const url=URL.createObjectURL(file)
    setPreview(url)
    return ()=>URL.revokeObjectURL(url)
  },[file])

  return (
    <div className="rounded-xl overflow-hidden bg-white/5 border border-white/10">
      <div className="h-28 bg-black/20">
        {preview&&<img src={preview} alt={file.name} className="w-full h-full object-cover"/>}
      </div>
      <div className="p-3">
        <p className="text-xs truncate" style={{ color: '#f0f0f2' }}>{file.name}</p>
        <p className="text-[11px] mt-1" style={{ color: '#6b6b78' }}>{(file.size/1024/1024).toFixed(1)} MB · aguardando salvar</p>
        <button type="button" onClick={onRemove} className="text-[11px] text-red-300 mt-2">Remover</button>
      </div>
    </div>
  )
}
