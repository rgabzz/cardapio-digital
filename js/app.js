// ==========================================================================
// app.js — Lógica do Cardápio Digital "Sabor & Arte"
// Depende de: produtos.js (arrays globais `produtos` e `categorias`)
// ==========================================================================

"use strict";

/* ----- Configurações ----- */
const IMAGENS_CATEGORIA = {
  "ENTRADAS": "img/cat-entradas.webp",
  "PRATO PRINCIPAL": "img/cat-principal.webp",
  "SOBREMESAS": "img/cat-sobremesas.webp",
  "BEBIDAS": "img/cat-bebidas.webp",
  "CARTA DE VINHOS": "img/cat-vinhos.webp",
};

// Cupons disponíveis (percentual ou valor fixo)
const CUPONS = {
  "BEMVINDO10": { tipo: "percent", valor: 10, rotulo: "10% de desconto" },
  "SABOR15": { tipo: "percent", valor: 15, rotulo: "15% de desconto" },
  "PRIMEIRA20": { tipo: "percent", valor: 20, rotulo: "20% de desconto" },
  "CHEF25": { tipo: "fixo", valor: 25, rotulo: "R$ 25,00 de desconto" },
};

const TAXA_GARCOM = 0.10;
const STORAGE_KEY = "sabor-arte-pedido";
const TEMA_KEY = "sabor-arte-tema";

/* ----- Estado da aplicação ----- */
let carrinho = {}; // { [id]: quantidade }
let incluirGarcom = true;
let cupomAplicado = null; // chave do cupom

/* ----- Utilidades ----- */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const formatarMoeda = (valor) =>
  valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const acharProduto = (id) => produtos.find((p) => p.id === id);

/* ==========================================================================
   PERSISTÊNCIA (localStorage) — o pedido sobrevive ao recarregar a página
   ========================================================================== */
function salvarEstado() {
  const dados = { carrinho, incluirGarcom, cupomAplicado };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dados));
  } catch (e) {
    console.log("[v0] Não foi possível salvar o pedido:", e.message);
  }
}

function carregarEstado() {
  try {
    const bruto = localStorage.getItem(STORAGE_KEY);
    if (!bruto) return;
    const dados = JSON.parse(bruto);
    carrinho = dados.carrinho || {};
    incluirGarcom = dados.incluirGarcom !== false;
    cupomAplicado = dados.cupomAplicado || null;
  } catch (e) {
    console.log("[v0] Não foi possível carregar o pedido:", e.message);
  }
}

/* ==========================================================================
   TEMA CLARO / ESCURO
   ========================================================================== */
function iniciarTema() {
  const salvo = localStorage.getItem(TEMA_KEY);
  if (salvo) document.documentElement.setAttribute("data-theme", salvo);

  $("#themeToggle").addEventListener("click", () => {
    const atual = document.documentElement.getAttribute("data-theme");
    const novo = atual === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", novo);
    localStorage.setItem(TEMA_KEY, novo);
  });
}

/* ==========================================================================
   MENU DE CATEGORIAS (navegação + filtro)
   ========================================================================== */
function montarNavCategorias() {
  const nav = $("#catNav");
  nav.innerHTML = categorias
    .map((cat) => `<a href="#cat-${slug(cat)}">${cat}</a>`)
    .join("");

  const filtro = $("#categoryFilter");
  categorias.forEach((cat) => {
    const opt = document.createElement("option");
    opt.value = cat;
    opt.textContent = cat;
    filtro.appendChild(opt);
  });
}

const slug = (texto) =>
  texto.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "-");

/* ==========================================================================
   RENDERIZAÇÃO DO CARDÁPIO (dinâmica, com busca / filtro / ordenação)
   ========================================================================== */
function faixaDePrecoMax() {
  return Math.ceil(Math.max(...produtos.map((p) => p.preco)));
}

function iniciarFaixaPreco() {
  const range = $("#priceRange");
  const max = faixaDePrecoMax();
  range.max = max;
  range.value = max;
  $("#priceValue").textContent = formatarMoeda(max);
}

function renderizarCardapio() {
  const termo = $("#searchInput").value.trim().toLowerCase();
  const categoriaSel = $("#categoryFilter").value;
  const ordem = $("#sortSelect").value;
  const precoMax = Number($("#priceRange").value);

  // 1) Filtra
  let lista = produtos.filter((p) => {
    const casaTermo = p.nome.toLowerCase().includes(termo) || p.descricao.toLowerCase().includes(termo);
    const casaCategoria = categoriaSel === "TODAS" || p.categoria === categoriaSel;
    const casaPreco = p.preco <= precoMax;
    return casaTermo && casaCategoria && casaPreco;
  });

  // 2) Ordena
  if (ordem === "preco-asc") lista.sort((a, b) => a.preco - b.preco);
  else if (ordem === "preco-desc") lista.sort((a, b) => b.preco - a.preco);
  else if (ordem === "nome-asc") lista.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  // 3) Info de resultados
  $("#resultsInfo").textContent =
    `${lista.length} ${lista.length === 1 ? "prato encontrado" : "pratos encontrados"}`;

  const container = $("#menuContainer");
  const vazio = $("#emptyState");

  if (lista.length === 0) {
    container.innerHTML = "";
    vazio.hidden = false;
    return;
  }
  vazio.hidden = true;

  // 4) Agrupa por categoria, respeitando a ordem oficial
  const html = categorias
    .filter((cat) => lista.some((p) => p.categoria === cat))
    .map((cat) => {
      const itens = lista.filter((p) => p.categoria === cat);
      const cards = itens.map(cardHTML).join("");
      return `
        <div class="cat-block" id="cat-${slug(cat)}">
          <div class="cat-banner">
            <img src="${IMAGENS_CATEGORIA[cat] || ""}" alt="Foto ilustrativa da categoria ${cat}" loading="lazy" />
            <div class="cat-banner-text">
              <h3>${cat}</h3>
              <span>${itens.length} ${itens.length === 1 ? "opção" : "opções"}</span>
            </div>
          </div>
          <div class="grid">${cards}</div>
        </div>`;
    })
    .join("");

  container.innerHTML = html;
}

function cardHTML(p) {
  return `
    <article class="card">
      <span class="card-tag">${p.categoria}</span>
      <h4>${p.nome}</h4>
      <p class="card-desc">${p.descricao}</p>
      <div class="card-foot">
        <span class="card-price">${formatarMoeda(p.preco)}</span>
        <button class="add-btn" type="button" data-add="${p.id}">Adicionar</button>
      </div>
    </article>`;
}

/* ==========================================================================
   CARRINHO / MEU PEDIDO
   ========================================================================== */
function adicionarAoPedido(id) {
  carrinho[id] = (carrinho[id] || 0) + 1;
  salvarEstado();
  atualizarCarrinho();
  atualizarBadge();
}

function alterarQuantidade(id, delta) {
  if (!carrinho[id]) return;
  carrinho[id] += delta;
  if (carrinho[id] <= 0) delete carrinho[id];
  salvarEstado();
  atualizarCarrinho();
  atualizarBadge();
}

function removerDoPedido(id) {
  delete carrinho[id];
  salvarEstado();
  atualizarCarrinho();
  atualizarBadge();
}

function itensDoCarrinho() {
  return Object.entries(carrinho)
    .map(([id, qtd]) => ({ produto: acharProduto(id), qtd }))
    .filter((i) => i.produto);
}

function calcularTotais() {
  const itens = itensDoCarrinho();
  const subtotal = itens.reduce((s, i) => s + i.produto.preco * i.qtd, 0);

  let desconto = 0;
  if (cupomAplicado && CUPONS[cupomAplicado]) {
    const c = CUPONS[cupomAplicado];
    desconto = c.tipo === "percent" ? subtotal * (c.valor / 100) : c.valor;
    desconto = Math.min(desconto, subtotal); // nunca maior que o subtotal
  }

  const base = subtotal - desconto;
  const garcom = incluirGarcom ? base * TAXA_GARCOM : 0;
  const total = base + garcom;

  return { subtotal, desconto, garcom, total, qtdItens: itens.reduce((s, i) => s + i.qtd, 0) };
}

function atualizarBadge() {
  const total = Object.values(carrinho).reduce((s, q) => s + q, 0);
  const badge = $("#cartBadge");
  badge.textContent = total;
  badge.style.display = total > 0 ? "grid" : "none";
}

function atualizarCarrinho() {
  const lista = $("#cartList");
  const vazio = $("#cartEmpty");
  const foot = $("#cartFoot");
  const itens = itensDoCarrinho();

  // Sincroniza destaque dos botões "Adicionar"
  $$("[data-add]").forEach((btn) => {
    const noPedido = !!carrinho[btn.dataset.add];
    btn.classList.toggle("added", noPedido);
    btn.textContent = noPedido ? "Adicionado ✓" : "Adicionar";
  });

  if (itens.length === 0) {
    lista.innerHTML = "";
    vazio.hidden = false;
    foot.hidden = true;
    return;
  }

  vazio.hidden = true;
  foot.hidden = false;

  lista.innerHTML = itens
    .map(({ produto, qtd }) => `
      <li class="cart-item">
        <div>
          <h4>${produto.nome}</h4>
          <span class="unit">${formatarMoeda(produto.preco)} / un.</span>
        </div>
        <span class="line-total">${formatarMoeda(produto.preco * qtd)}</span>
        <div class="qty" role="group" aria-label="Quantidade de ${produto.nome}">
          <button type="button" data-dec="${produto.id}" aria-label="Diminuir">−</button>
          <span>${qtd}</span>
          <button type="button" data-inc="${produto.id}" aria-label="Aumentar">+</button>
        </div>
        <button class="remove-btn" type="button" data-remove="${produto.id}">Remover</button>
      </li>`)
    .join("");

  // Atualiza totais
  const { subtotal, desconto, garcom, total } = calcularTotais();
  $("#subtotalOut").textContent = formatarMoeda(subtotal);
  $("#tipOut").textContent = formatarMoeda(garcom);
  $("#totalOut").textContent = formatarMoeda(total);
  $("#garcomCheck").checked = incluirGarcom;
  $("#tipRow").style.opacity = incluirGarcom ? "1" : "0.5";

  const discountRow = $("#discountRow");
  if (desconto > 0) {
    discountRow.hidden = false;
    $("#discountOut").textContent = "- " + formatarMoeda(desconto);
  } else {
    discountRow.hidden = true;
  }

  // Reflete cupom aplicado
  if (cupomAplicado) {
    $("#couponInput").value = cupomAplicado;
    $("#couponMsg").textContent = `Cupom aplicado: ${CUPONS[cupomAplicado].rotulo}`;
    $("#couponMsg").className = "coupon-msg ok";
  }
}

/* ==========================================================================
   CUPOM
   ========================================================================== */
function aplicarCupom() {
  const campo = $("#couponInput");
  const msg = $("#couponMsg");
  const codigo = campo.value.trim().toUpperCase();

  if (!codigo) {
    cupomAplicado = null;
    msg.textContent = "Cupom removido.";
    msg.className = "coupon-msg";
  } else if (CUPONS[codigo]) {
    cupomAplicado = codigo;
    msg.textContent = `Cupom aplicado: ${CUPONS[codigo].rotulo}`;
    msg.className = "coupon-msg ok";
  } else {
    cupomAplicado = null;
    msg.textContent = "Cupom inválido.";
    msg.className = "coupon-msg err";
  }
  salvarEstado();
  atualizarCarrinho();
}

/* ==========================================================================
   DRAWER (abrir/fechar Meu Pedido)
   ========================================================================== */
function abrirCarrinho() {
  $("#cartDrawer").classList.add("open");
  $("#cartDrawer").setAttribute("aria-hidden", "false");
  $("#overlay").hidden = false;
  document.body.classList.add("no-scroll");
}
function fecharCarrinho() {
  $("#cartDrawer").classList.remove("open");
  $("#cartDrawer").setAttribute("aria-hidden", "true");
  $("#overlay").hidden = true;
  document.body.classList.remove("no-scroll");
}

/* ==========================================================================
   FINALIZAÇÃO (checkout) + cálculo de troco
   ========================================================================== */
function abrirCheckout() {
  if (itensDoCarrinho().length === 0) return;
  renderResumoCheckout();
  $("#checkoutModal").hidden = false;
  document.body.classList.add("no-scroll");
}
function fecharCheckout() {
  $("#checkoutModal").hidden = true;
  if ($("#confirmModal").hidden) document.body.classList.remove("no-scroll");
}

function renderResumoCheckout() {
  const { subtotal, desconto, garcom, total } = calcularTotais();
  const itens = itensDoCarrinho();
  const linhasItens = itens
    .map((i) => `<div class="sum-item"><span>${i.qtd}× ${i.produto.nome}</span><span>${formatarMoeda(i.produto.preco * i.qtd)}</span></div>`)
    .join("");

  $("#checkoutSummary").innerHTML = `
    ${linhasItens}
    <hr />
    <div class="sum-row"><span>Subtotal</span><span>${formatarMoeda(subtotal)}</span></div>
    ${desconto > 0 ? `<div class="sum-row"><span>Desconto</span><span>- ${formatarMoeda(desconto)}</span></div>` : ""}
    ${garcom > 0 ? `<div class="sum-row"><span>Garçom (10%)</span><span>${formatarMoeda(garcom)}</span></div>` : ""}
    <div class="sum-row sum-grand"><span>Total</span><span>${formatarMoeda(total)}</span></div>`;
}

function atualizarCampoTroco() {
  const metodo = $("input[name='payment']:checked").value;
  const cashField = $("#cashField");
  const msg = $("#changeMsg");

  if (metodo !== "Dinheiro") {
    cashField.hidden = true;
    msg.textContent = "";
    return;
  }
  cashField.hidden = false;

  const { total } = calcularTotais();
  const pago = Number($("#cashAmount").value);
  if (!pago) {
    msg.textContent = "";
  } else if (pago < total) {
    msg.textContent = `Valor insuficiente. Faltam ${formatarMoeda(total - pago)}.`;
    msg.className = "change-msg err";
  } else {
    msg.textContent = `Troco: ${formatarMoeda(pago - total)}`;
    msg.className = "change-msg";
  }
}

function gerarNumeroPedido() {
  return "#" + String(Math.floor(1000 + Math.random() * 9000));
}

function confirmarPedido(evento) {
  evento.preventDefault();
  const erro = $("#formError");
  const nome = $("#clientName").value.trim();
  const mesa = $("#tableNumber").value.trim();
  const metodo = $("input[name='payment']:checked").value;

  // Validação
  if (!nome || !mesa) {
    erro.hidden = false;
    erro.textContent = "Por favor, preencha o nome do cliente e o número da mesa.";
    return;
  }
  if (metodo === "Dinheiro") {
    const pago = Number($("#cashAmount").value);
    const { total } = calcularTotais();
    if (pago && pago < total) {
      erro.hidden = false;
      erro.textContent = "O valor em dinheiro é menor que o total do pedido.";
      return;
    }
  }
  erro.hidden = true;

  const { subtotal, desconto, garcom, total } = calcularTotais();
  const numero = gerarNumeroPedido();
  const itens = itensDoCarrinho();
  const obs = $("#notes").value.trim();
  const pago = metodo === "Dinheiro" ? Number($("#cashAmount").value) : 0;
  const troco = pago && pago >= total ? pago - total : 0;

  // Monta resumo de confirmação
  const linhasItens = itens
    .map((i) => `<div class="sum-item"><span>${i.qtd}× ${i.produto.nome}</span><span>${formatarMoeda(i.produto.preco * i.qtd)}</span></div>`)
    .join("");

  $("#orderNumber").textContent = numero;
  $("#confirmSummary").innerHTML = `
    <div class="sum-row"><span><strong>Cliente</strong></span><span>${nome}</span></div>
    <div class="sum-row"><span><strong>Mesa</strong></span><span>${mesa}</span></div>
    <div class="sum-row"><span><strong>Pagamento</strong></span><span>${metodo}</span></div>
    ${obs ? `<div class="sum-row"><span><strong>Obs.</strong></span><span>${obs}</span></div>` : ""}
    <hr />
    ${linhasItens}
    <hr />
    <div class="sum-row"><span>Subtotal</span><span>${formatarMoeda(subtotal)}</span></div>
    ${desconto > 0 ? `<div class="sum-row"><span>Desconto</span><span>- ${formatarMoeda(desconto)}</span></div>` : ""}
    ${garcom > 0 ? `<div class="sum-row"><span>Garçom (10%)</span><span>${formatarMoeda(garcom)}</span></div>` : ""}
    <div class="sum-row sum-grand"><span>Total</span><span>${formatarMoeda(total)}</span></div>
    ${troco > 0 ? `<div class="sum-row"><span>Troco</span><span>${formatarMoeda(troco)}</span></div>` : ""}`;

  // Mostra confirmação e limpa o pedido
  $("#checkoutModal").hidden = true;
  $("#confirmModal").hidden = false;

  carrinho = {};
  cupomAplicado = null;
  incluirGarcom = true;
  salvarEstado();
  atualizarBadge();
  atualizarCarrinho();
  $("#checkoutForm").reset();
}

function novoPedido() {
  $("#confirmModal").hidden = true;
  document.body.classList.remove("no-scroll");
  fecharCarrinho();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* ==========================================================================
   EVENTOS
   ========================================================================== */
function ligarEventos() {
  // Delegação: botões "Adicionar" e controles do carrinho
  document.addEventListener("click", (e) => {
    const alvo = e.target.closest("[data-add],[data-inc],[data-dec],[data-remove]");
    if (!alvo) return;
    if (alvo.dataset.add) adicionarAoPedido(alvo.dataset.add);
    else if (alvo.dataset.inc) alterarQuantidade(alvo.dataset.inc, 1);
    else if (alvo.dataset.dec) alterarQuantidade(alvo.dataset.dec, -1);
    else if (alvo.dataset.remove) removerDoPedido(alvo.dataset.remove);
  });

  // Filtros e busca
  $("#searchInput").addEventListener("input", renderizarCardapio);
  $("#categoryFilter").addEventListener("change", renderizarCardapio);
  $("#sortSelect").addEventListener("change", renderizarCardapio);
  $("#priceRange").addEventListener("input", (e) => {
    $("#priceValue").textContent = formatarMoeda(Number(e.target.value));
    renderizarCardapio();
  });

  // Menu de categorias tambem sincroniza busca e filtro,
  // garantindo que a seção de destino sempre exista no DOM
  $("#catNav").addEventListener("click", (e) => {
    const link = e.target.closest("a");
    if (!link) return;
    $("#searchInput").value = "";
    $("#categoryFilter").value = "TODAS";
    renderizarCardapio();
  });

  // Drawer
  $("#openCart").addEventListener("click", abrirCarrinho);
  $("#heroCart").addEventListener("click", abrirCarrinho);
  $("#closeCart").addEventListener("click", fecharCarrinho);
  $("#overlay").addEventListener("click", fecharCarrinho);

  // Garçom e cupom
  $("#garcomCheck").addEventListener("change", (e) => {
    incluirGarcom = e.target.checked;
    salvarEstado();
    atualizarCarrinho();
  });
  $("#applyCoupon").addEventListener("click", aplicarCupom);
  $("#couponInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.isComposing && e.keyCode !== 229) {
      e.preventDefault();
      aplicarCupom();
    }
  });

  // Checkout
  $("#goCheckout").addEventListener("click", abrirCheckout);
  $("#closeCheckout").addEventListener("click", fecharCheckout);
  $("#checkoutForm").addEventListener("submit", confirmarPedido);
  $$("input[name='payment']").forEach((r) => r.addEventListener("change", atualizarCampoTroco));
  $("#cashAmount").addEventListener("input", atualizarCampoTroco);
  $("#newOrder").addEventListener("click", novoPedido);

  // Fechar modais com ESC
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (!$("#checkoutModal").hidden) fecharCheckout();
    else fecharCarrinho();
  });
}

/* ==========================================================================
   INICIALIZAÇÃO
   ========================================================================== */
function init() {
  carregarEstado();
  iniciarTema();
  montarNavCategorias();
  iniciarFaixaPreco();
  renderizarCardapio();
  ligarEventos();
  atualizarBadge();
  atualizarCarrinho();
}

document.addEventListener("DOMContentLoaded", init);
