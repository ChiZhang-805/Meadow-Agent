import { Eye, EyeOff, KeyRound, MapPin, PanelLeftClose, Save } from "lucide-react";
import { useEffect, useState } from "react";

import { saveAMapKey, getConfigStatus, saveOpenAIKey, type ConfigStatus } from "../api/devConfig";
import { getAddressSuggestions, saveDeliveryAddress, type AddressSuggestion } from "../api/location";

interface ConfigSidebarProps {
  open: boolean;
  userId: string;
  onClose: () => void;
}

export function ConfigSidebar({ open, userId, onClose }: ConfigSidebarProps) {
  const [status, setStatus] = useState<ConfigStatus | null>(null);
  const [openAIKey, setOpenAIKey] = useState("");
  const [showOpenAIKey, setShowOpenAIKey] = useState(false);
  const [amapKey, setAMapKey] = useState("");
  const [showAMapKey, setShowAMapKey] = useState(false);
  const [addressQuery, setAddressQuery] = useState("");
  const [addressCity, setAddressCity] = useState("");
  const [addressDetail, setAddressDetail] = useState("");
  const [addressSuggestions, setAddressSuggestions] = useState<AddressSuggestion[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<AddressSuggestion | null>(null);
  const [busy, setBusy] = useState(false);
  const [addressBusy, setAddressBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!open) return;
    void refreshStatus();
  }, [open, userId]);

  useEffect(() => {
    if (!open) return;
    const query = addressQuery.trim();
    if (query.length < 2) {
      setAddressSuggestions([]);
      return;
    }

    const timer = window.setTimeout(() => {
      void searchAddress(query);
    }, 320);

    return () => window.clearTimeout(timer);
  }, [addressQuery, addressCity, open]);

  async function refreshStatus() {
    try {
      setStatus(await getConfigStatus(userId));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  const hasOpenAIKeyInput = openAIKey.trim().length > 0;
  const hasAMapKeyInput = amapKey.trim().length > 0;
  const canSaveAnyKey = hasOpenAIKeyInput || hasAMapKeyInput;

  async function saveKeys() {
    setBusy(true);
    setMessage("");
    try {
      const tasks: Promise<unknown>[] = [];

      if (hasOpenAIKeyInput) {
        if (openAIKey.trim().length < 20) {
          throw new Error("OpenAI API Key 太短");
        }
        tasks.push(saveOpenAIKey(openAIKey, userId));
      }

      if (hasAMapKeyInput) {
        if (amapKey.trim().length < 6) {
          throw new Error("高德地图 API Key 太短");
        }
        tasks.push(saveAMapKey(amapKey, userId));
      }

      await Promise.all(tasks);
      if (hasOpenAIKeyInput) {
        setOpenAIKey("");
        setShowOpenAIKey(false);
      }
      if (hasAMapKeyInput) {
        setAMapKey("");
        setShowAMapKey(false);
      }
      await refreshStatus();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  async function searchAddress(query: string) {
    setAddressBusy(true);
    setMessage("");
    try {
      const suggestions = await getAddressSuggestions({
        user_id: userId,
        query,
        city: addressCity.trim() || undefined
      });
      setAddressSuggestions(suggestions);
    } catch (error) {
      setAddressSuggestions([]);
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setAddressBusy(false);
    }
  }

  async function saveAddress() {
    if (!selectedAddress) return;
    setAddressBusy(true);
    setMessage("");
    try {
      await saveDeliveryAddress({
        user_id: userId,
        name: selectedAddress.name,
        district: selectedAddress.district,
        address: selectedAddress.address,
        location: selectedAddress.location,
        detail: addressDetail.trim() || null
      });
      setAddressQuery(selectedAddress.name);
      setAddressSuggestions([]);
      await refreshStatus();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setAddressBusy(false);
    }
  }

  return (
    <>
      <div className={`sidebar-scrim ${open ? "sidebar-scrim-open" : ""}`} onClick={onClose} />
      <aside className={`config-sidebar ${open ? "config-sidebar-open" : ""}`} aria-hidden={!open}>
        <header className="config-header">
          <div>
            <h2>个人信息</h2>
          </div>
          <button className="icon-button" onClick={onClose} title="关闭侧边栏">
            <PanelLeftClose aria-hidden="true" size={26} />
          </button>
        </header>

        <section className="secret-editor" aria-label="API Key">
          <SecretInput
            id="openai-key-input"
            label="OpenAI API Key"
            placeholder="sk-..."
            value={openAIKey}
            visible={showOpenAIKey}
            onChange={setOpenAIKey}
            onToggleVisible={() => setShowOpenAIKey((value) => !value)}
          />
          <SecretInput
            id="amap-key-input"
            label="高德地图 API Key"
            placeholder="AMap Web服务 Key"
            value={amapKey}
            visible={showAMapKey}
            onChange={setAMapKey}
            onToggleVisible={() => setShowAMapKey((value) => !value)}
          />
          <button className="save-secret-button" disabled={busy || !canSaveAnyKey} onClick={saveKeys}>
            <Save aria-hidden="true" size={24} />
            保存 Key
          </button>
        </section>

        <section className="address-editor" aria-label="收货地址">
          <label htmlFor="address-query-input">
            <MapPin aria-hidden="true" size={22} />
            <span>收货地址</span>
          </label>
          <input
            id="address-city-input"
            className="profile-input"
            placeholder="城市，可选"
            value={addressCity}
            onChange={(event) => setAddressCity(event.target.value)}
          />
          <input
            id="address-query-input"
            className="profile-input"
            placeholder="输入小区、商场、街道"
            value={addressQuery}
            onChange={(event) => {
              setAddressQuery(event.target.value);
              setSelectedAddress(null);
            }}
          />

          <div className="address-suggestions">
            {addressBusy ? <p>查找中</p> : null}
            {addressSuggestions.map((suggestion) => (
              <button
                className={selectedAddress?.id === suggestion.id && selectedAddress?.name === suggestion.name ? "selected" : ""}
                key={`${suggestion.id ?? suggestion.name}-${suggestion.location ?? ""}`}
                type="button"
                onClick={() => {
                  setSelectedAddress(suggestion);
                  setAddressQuery(suggestion.name);
                }}
              >
                <strong>{suggestion.name}</strong>
                <span>{formatAddressSuggestion(suggestion)}</span>
              </button>
            ))}
          </div>

          <input
            className="profile-input"
            placeholder="楼号、单元号、门牌号"
            value={addressDetail}
            onChange={(event) => setAddressDetail(event.target.value)}
          />
          <button className="save-secret-button" disabled={addressBusy || !selectedAddress} onClick={saveAddress}>
            <Save aria-hidden="true" size={24} />
            保存地址
          </button>
        </section>

        {message ? <p className="config-message">{message}</p> : null}

        <section className="external-config-list" aria-label="外部配置项">
          <h3>外部配置项</h3>
          {status?.items.map((item) => (
            <article className="external-config-item" key={item.name}>
              <div>
                <strong>{item.name}</strong>
                <span>{item.required_for_mvp ? "MVP 必需" : "后续预留"}</span>
              </div>
              <footer>
                <mark className={item.configured ? "mark-ready" : "mark-missing"}>
                  {item.configured ? "已配置" : "未配置"}
                </mark>
                <small>{sourceText(item.source)}</small>
              </footer>
            </article>
          ))}
        </section>
      </aside>
    </>
  );
}

interface SecretInputProps {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  visible: boolean;
  onChange: (value: string) => void;
  onToggleVisible: () => void;
}

function SecretInput({
  id,
  label,
  placeholder,
  value,
  visible,
  onChange,
  onToggleVisible
}: SecretInputProps) {
  return (
    <div className="secret-block">
      <label htmlFor={id}>
        <KeyRound aria-hidden="true" size={22} />
        <span>{label}</span>
      </label>
      <div className="secret-input-row">
        <input
          id={id}
          autoComplete="off"
          inputMode="text"
          placeholder={placeholder}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <button
          className="icon-button"
          type="button"
          onClick={onToggleVisible}
          title={visible ? "隐藏 API Key" : "显示 API Key"}
        >
          {visible ? <EyeOff aria-hidden="true" size={24} /> : <Eye aria-hidden="true" size={24} />}
        </button>
      </div>
    </div>
  );
}

function formatAddressSuggestion(suggestion: AddressSuggestion) {
  return [suggestion.district, suggestion.address].filter(Boolean).join(" ") || " ";
}

function sourceText(source: string) {
  if (source === "profile") return "个人信息";
  if (source === "runtime_memory") return "后端内存";
  if (source === "environment") return "环境变量";
  if (source === "not_used") return "暂未使用";
  return source;
}
