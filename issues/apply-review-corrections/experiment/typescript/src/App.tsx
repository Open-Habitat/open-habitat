import { useState } from "react";
import { Button } from "react-aria-components";
export function App() {
  const [count, setCount] = useState(0);
  return (
    <main>
      <h1>Native Agent Host</h1>
      <Button onPress={() => setCount((n) => n + 1)}>Testi {count}</Button>
    </main>
  );
}
