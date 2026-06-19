import type { GroceryOption } from "../api/grocery";

interface GroceryOptionCardsProps {
  options: GroceryOption[];
  onPreview: (optionId: string) => void;
}

export function GroceryOptionCards({ options, onPreview }: GroceryOptionCardsProps) {
  if (options.length === 0) {
    return (
      <section className="grocery-strip grocery-strip-empty" aria-label="订单预览">
        <p className="order-empty">暂无订单预览</p>
      </section>
    );
  }

  return (
    <section className="grocery-strip" aria-label="订单预览">
      {options.map((option) => (
        <article className="grocery-card" key={option.id}>
          <div>
            <h3>{option.title}</h3>
            <p>{option.shop_name}</p>
          </div>
          <ul className="grocery-items">
            {option.items.map((item, index) => (
              <li key={`${option.id}-${index}`}>
                <span>{String(item.name ?? "菜品")}</span>
                <em>{String(item.quantity ?? "适量")}</em>
              </li>
            ))}
          </ul>
          <dl>
            <div>
              <dt>合计</dt>
              <dd>{((option.price_cents + option.delivery_fee_cents) / 100).toFixed(2)} 元</dd>
            </div>
            <div>
              <dt>送达</dt>
              <dd>{option.eta_minutes} 分钟</dd>
            </div>
          </dl>
          <button onClick={() => onPreview(option.id)}>查看预览</button>
        </article>
      ))}
    </section>
  );
}
