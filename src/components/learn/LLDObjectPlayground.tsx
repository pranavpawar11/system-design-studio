import { useEffect, useState } from 'react';
import { ArrowDown, Box, CreditCard, ShoppingCart } from 'lucide-react';
import './learning-mini-visuals.css';

type Language = 'java' | 'cpp' | 'python';
const components = [
  {
    name: 'Order',
    icon: ShoppingCart,
    files: { java: 'Order.java', cpp: 'order.cpp', python: 'order.py' },
    code: {
      java: 'class Order {\n    private List<OrderItem> items;\n\n    double calculateTotal() {\n        return items.stream()\n            .mapToDouble(OrderItem::subtotal).sum();\n    }\n}',
      cpp: 'class Order {\n    vector<OrderItem> items;\npublic:\n    double calculateTotal() {\n        double total = 0;\n        for (const auto& item : items) total += item.subtotal();\n        return total;\n    }\n};',
      python: 'class Order:\n    def __init__(self):\n        self.items = []\n\n    def calculate_total(self):\n        return sum(item.subtotal() for item in self.items)',
    },
  },
  {
    name: 'OrderItem',
    icon: Box,
    files: { java: 'OrderItem.java', cpp: 'order_item.cpp', python: 'order_item.py' },
    code: {
      java: 'class OrderItem {\n    private Product product;\n    private int quantity;\n    double subtotal() {\n        return product.price() * quantity;\n    }\n}',
      cpp: 'class OrderItem {\n    Product product;\n    int quantity;\npublic:\n    double subtotal() const {\n        return product.price() * quantity;\n    }\n};',
      python: 'class OrderItem:\n    def __init__(self, product, quantity):\n        self.product, self.quantity = product, quantity\n    def subtotal(self):\n        return self.product.price * self.quantity',
    },
  },
  {
    name: 'Payment',
    icon: CreditCard,
    files: { java: 'Payment.java', cpp: 'payment.cpp', python: 'payment.py' },
    code: {
      java: 'class Payment {\n    private PaymentStatus status;\n\n    Receipt charge(Order order) {\n        double amount = order.calculateTotal();\n        return gateway.authorize(amount);\n    }\n}',
      cpp: 'class Payment {\n    PaymentStatus status;\npublic:\n    Receipt charge(const Order& order) {\n        auto amount = order.calculateTotal();\n        return gateway.authorize(amount);\n    }\n};',
      python: 'class Payment:\n    def charge(self, order):\n        amount = order.calculate_total()\n        receipt = self.gateway.authorize(amount)\n        self.status = PaymentStatus.PAID\n        return receipt',
    },
  },
] as const;

export default function LLDObjectPlayground({ language = 'java' }: { language?: string }) {
  const [active, setActive] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setActive((value) => (value + 1) % components.length), 3000);
    return () => window.clearInterval(timer);
  }, []);
  const current = components[active];
  const lang = (['java', 'cpp', 'python'].includes(language) ? language : 'java') as Language;
  const Icon = current.icon;
  return <section className="learning-mini-visual lld-mini-visual lld-code-visual" aria-label="Object design and implementation progression">
    <div className="learning-mini-head"><span>OBJECT DESIGN EVOLVES</span><b>{current.name.toUpperCase()} · {lang.toUpperCase()}</b></div>
    <div className="lld-object-sequence" aria-label="Order to OrderItem to Payment">
      {components.map((item, index) => {
        const NodeIcon = item.icon;
        return <div className={`lld-object-step ${index === active ? 'active' : ''}`} key={item.name}>
          <NodeIcon size={16}/><b>{item.name}</b>
          {index < components.length - 1 && <span className="lld-object-arrow">→</span>}
        </div>;
      })}
    </div>
    <div className="lld-code-pointer" aria-hidden="true"><ArrowDown size={19}/><span> {current.name} implementation</span></div>
    <div className="lld-mini-code" key={`${active}-${lang}`}>
      <div className="lld-mini-code-head"><span>{current.files[lang]}</span><b>{lang === 'cpp' ? 'C++' : lang === 'python' ? 'Python' : 'Java'}</b></div>
      <pre><code>{current.code[lang]}</code></pre>
    </div>
    <div className="learning-mini-foot"><span>Object</span><div>{components.map((item, index) => <i key={item.name} className={index === active ? 'active' : ''}/>)}</div><span>Collaboration</span></div>
  </section>;
}
