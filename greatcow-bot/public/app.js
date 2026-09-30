(() => {
  const tg = window.Telegram?.WebApp;
  if (tg) {
    tg.ready();
    tg.expand();
    try {
      tg.setHeaderColor("#976F22");
      tg.setBackgroundColor("#FFF8E9");
    } catch {
      // старые клиенты Telegram могут не поддерживать методы темы — не критично
    }
  }

  const state = {
    menu: [],
    cart: new Map(), // itemId -> { item, qty }
    fulfillment: "pickup",
  };

  const el = {
    tabs: document.getElementById("tabs"),
    menuList: document.getElementById("menuList"),
    cartBtn: document.getElementById("cartBtn"),
    cartBadge: document.getElementById("cartBadge"),
    cartBar: document.getElementById("cartBar"),
    cartBarBtn: document.getElementById("cartBarBtn"),
    cartBarCount: document.getElementById("cartBarCount"),
    cartBarTotal: document.getElementById("cartBarTotal"),
    checkoutOverlay: document.getElementById("checkoutOverlay"),
    checkoutBack: document.getElementById("checkoutBack"),
    checkoutClose: document.getElementById("checkoutClose"),
    cartItems: document.getElementById("cartItems"),
    cartTotal: document.getElementById("cartTotal"),
    checkoutForm: document.getElementById("checkoutForm"),
    addressField: document.getElementById("addressField"),
    submitBtn: document.getElementById("submitBtn"),
    successOverlay: document.getElementById("successOverlay"),
    successText: document.getElementById("successText"),
    successCloseBtn: document.getElementById("successCloseBtn"),
    itemCardTemplate: document.getElementById("itemCardTemplate"),
  };

  function money(n) {
    return `${n.toLocaleString("ru-RU")} ₽`;
  }

  function cartCount() {
    let n = 0;
    for (const { qty } of state.cart.values()) n += qty;
    return n;
  }

  function cartTotal() {
    let sum = 0;
    for (const { item, qty } of state.cart.values()) sum += item.price * qty;
    return sum;
  }

  function setQty(item, qty) {
    if (qty <= 0) {
      state.cart.delete(item.id);
    } else {
      state.cart.set(item.id, { item, qty });
    }
    renderCartUI();
    renderQtyForItem(item.id, qty);
  }

  function renderQtyForItem(itemId, qty) {
    const card = el.menuList.querySelector(`[data-item-id="${itemId}"]`);
    if (!card) return;
    card.classList.toggle("in-cart", qty > 0);
    card.querySelector(".qty-value").textContent = qty;
  }

  function renderCartUI() {
    const count = cartCount();
    const total = cartTotal();

    el.cartBadge.hidden = count === 0;
    el.cartBadge.textContent = count;

    el.cartBar.hidden = count === 0;
    el.cartBarCount.textContent = `${count} ${pluralize(count)}`;
    el.cartBarTotal.textContent = money(total);
  }

  function pluralize(n) {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return "товар";
    if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return "товара";
    return "товаров";
  }

  // ---------- Меню ----------
  function renderMenu() {
    el.tabs.innerHTML = "";
    el.menuList.innerHTML = "";

    state.menu.forEach((cat, idx) => {
      const chip = document.createElement("button");
      chip.className = "tab-chip" + (idx === 0 ? " active" : "");
      chip.textContent = `${cat.emoji} ${cat.title}`;
      chip.addEventListener("click", () => {
        document.getElementById(`cat-${cat.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      el.tabs.appendChild(chip);

      const heading = document.createElement("h2");
      heading.className = "section-title";
      heading.id = `cat-${cat.id}`;
      heading.textContent = `${cat.emoji} ${cat.title}`;
      el.menuList.appendChild(heading);

      cat.items.forEach((item) => {
        const node = el.itemCardTemplate.content.cloneNode(true);
        const card = node.querySelector(".item-card");
        card.dataset.itemId = item.id;
        node.querySelector(".item-name").textContent = item.name;
        node.querySelector(".item-desc").textContent = item.desc;
        node.querySelector(".item-price").textContent = money(item.price);

        node.querySelector(".qty-minus").addEventListener("click", () => {
          const current = state.cart.get(item.id)?.qty || 0;
          setQty(item, current - 1);
        });
        node.querySelector(".qty-plus").addEventListener("click", () => {
          const current = state.cart.get(item.id)?.qty || 0;
          setQty(item, current + 1);
        });

        el.menuList.appendChild(node);
      });
    });

    highlightActiveTabOnScroll();
  }

  function highlightActiveTabOnScroll() {
    const headings = [...el.menuList.querySelectorAll(".section-title")];
    const chips = [...el.tabs.querySelectorAll(".tab-chip")];
    if (headings.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const idx = headings.indexOf(entry.target);
          chips.forEach((c) => c.classList.remove("active"));
          chips[idx]?.classList.add("active");
        });
      },
      { rootMargin: "-140px 0px -70% 0px" }
    );
    headings.forEach((h) => observer.observe(h));
  }

  // ---------- Чекаут ----------
  function openCheckout() {
    renderCartItems();
    el.checkoutOverlay.hidden = false;
  }

  function closeCheckout() {
    el.checkoutOverlay.hidden = true;
  }

  function renderCartItems() {
    el.cartItems.innerHTML = "";
    for (const { item, qty } of state.cart.values()) {
      const row = document.createElement("div");
      row.className = "cart-line";
      row.innerHTML = `
        <div>
          <div class="cart-line-name">${item.name}</div>
          <div class="cart-line-sub">${qty} × ${money(item.price)}</div>
        </div>
        <div class="item-qty">
          <button class="qty-btn qty-minus" aria-label="Убрать">−</button>
          <span class="qty-value">${qty}</span>
          <button class="qty-btn qty-plus" aria-label="Добавить">+</button>
        </div>
      `;
      row.querySelector(".qty-minus").addEventListener("click", () => {
        setQty(item, qty - 1);
        renderCartItems();
        if (state.cart.size === 0) closeCheckout();
      });
      row.querySelector(".qty-plus").addEventListener("click", () => {
        setQty(item, qty + 1);
        renderCartItems();
      });
      el.cartItems.appendChild(row);
    }
    el.cartTotal.textContent = money(cartTotal());
  }

  el.cartBtn.addEventListener("click", openCheckout);
  el.cartBarBtn.addEventListener("click", openCheckout);
  el.checkoutBack.addEventListener("click", closeCheckout);
  el.checkoutClose.addEventListener("click", closeCheckout);

  // переключатель самовывоз/доставка
  document.querySelectorAll(".fulfillment-opt").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".fulfillment-opt").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      state.fulfillment = btn.dataset.value;
      el.addressField.hidden = state.fulfillment !== "delivery";
      el.addressField.querySelector("input").required = state.fulfillment === "delivery";
    });
  });

  // ---------- Отправка заказа ----------
  el.checkoutForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (state.cart.size === 0) return;

    el.submitBtn.disabled = true;
    el.submitBtn.textContent = "Отправляем...";

    const formData = new FormData(el.checkoutForm);
    const payload = {
      items: [...state.cart.values()].map(({ item, qty }) => ({ id: item.id, qty })),
      customerName: formData.get("customerName")?.toString().trim(),
      phone: formData.get("phone")?.toString().trim(),
      fulfillment: state.fulfillment,
      address: formData.get("address")?.toString().trim(),
      comment: formData.get("comment")?.toString().trim(),
    };

    try {
      const res = await fetch("/api/order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Telegram-Init-Data": tg?.initData || "",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "request_failed");
      }

      const data = await res.json();
      state.cart.clear();
      renderCartUI();
      renderMenuQuantitiesReset();
      closeCheckout();
      el.successText.textContent = `Заказ #${data.orderId} на сумму ${money(data.total)} принят. Мы свяжемся с вами для подтверждения.`;
      el.successOverlay.hidden = false;
      el.checkoutForm.reset();
      tg?.HapticFeedback?.notificationOccurred("success");
    } catch (err) {
      alert("Не получилось оформить заказ. Проверьте поля и попробуйте ещё раз.");
      console.error(err);
    } finally {
      el.submitBtn.disabled = false;
      el.submitBtn.textContent = "Оформить заказ";
    }
  });

  function renderMenuQuantitiesReset() {
    el.menuList.querySelectorAll(".item-card").forEach((card) => {
      card.classList.remove("in-cart");
      card.querySelector(".qty-value").textContent = "0";
    });
  }

  el.successCloseBtn.addEventListener("click", () => {
    el.successOverlay.hidden = true;
    if (tg && tg.platform !== "unknown") {
      tg.close();
    }
  });

  // ---------- Загрузка меню ----------
  async function init() {
    const res = await fetch("/api/menu");
    const data = await res.json();
    state.menu = data.menu;
    renderMenu();
    renderCartUI();
  }

  init();
})();
