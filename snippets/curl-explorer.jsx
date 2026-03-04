export const SCENE_LABELS = {}
export const VENDORS_ICONS = {}
export const CURLS_DATA = []

export const CopyButton = ({ text }) => {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true)
          setTimeout(() => setCopied(false), 2000)
        })
      }}
      style={{
        padding: "4px 12px", borderRadius: "6px", fontSize: "12px", fontWeight: 500,
        border: "1px solid", cursor: "pointer", flexShrink: 0,
        backgroundColor: copied ? "#dcfce7" : "#1e293b",
        borderColor: copied ? "#86efac" : "#334155",
        color: copied ? "#16a34a" : "#94a3b8",
        height: "24px", lineHeight: "24px",
      }}
    >{copied ? "Copied ✓" : "Copy"}</button>
  )
}

export const CurlBlock = ({ curl }) => (
  <div style={{ marginBottom: "16px", position: "relative" }}>
    <div style={{ fontSize: "11px", fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "6px" }}>{curl.n}</div>
    <pre style={{
      backgroundColor: "#0f172a", color: "#e2e8f0", padding: "16px", paddingTop: "40px", borderRadius: "8px",
      fontSize: "12px", lineHeight: "1.7", overflowX: "auto", margin: 0,
      whiteSpace: "pre-wrap", wordBreak: "break-all", fontFamily: "ui-monospace, monospace",
    }}>{curl.v}</pre>
    <div style={{ position: "absolute", top: "32px", right: "10px" }}>
      <CopyButton text={curl.v} />
    </div>
  </div>
)

export const CurlCard = ({ item }) => null

export const TagButton = ({ label, active, onClick }) => (
  <button
    onClick={onClick}
    style={{
      padding: "5px 12px", borderRadius: "20px", fontSize: "12px", fontWeight: 500,
      border: "1px solid", cursor: "pointer", transition: "all 0.15s", whiteSpace: "nowrap",
      backgroundColor: active ? "#EAF5F2" : "transparent",
      borderColor: active ? "#0D9373" : "#e2e8f0",
      color: active ? "#0D9373" : "#64748b",
    }}
  >{label}</button>
)

export const TabBtn = ({ label, active, onClick }) => (
  <button onClick={onClick} style={{
    padding: "3px 12px", borderRadius: "20px", fontSize: "12px", fontWeight: 500,
    border: "1px solid", cursor: "pointer", whiteSpace: "nowrap", transition: "all 0.15s",
    backgroundColor: active ? "#0D9373" : "transparent",
    borderColor: active ? "#0D9373" : "#e2e8f0",
    color: active ? "#fff" : "#64748b",
  }}>{label}</button>
)

export const VendorButton = ({ vendor, icon, active, onClick }) => (
  <button
    onClick={onClick}
    style={{
      display: "inline-flex", alignItems: "center", gap: "6px",
      padding: "4px 12px 4px 8px", borderRadius: "20px", fontSize: "14px", fontWeight: 500,
      border: "1px solid", cursor: "pointer", transition: "all 0.15s", whiteSpace: "nowrap",
      backgroundColor: active ? "#EAF5F2" : "transparent",
      borderColor: active ? "#0D9373" : "#e2e8f0",
      color: active ? "#0D9373" : "#64748b",
      height: "34px", lineHeight: "1.25",
    }}
  >
    <img src={icon} alt={vendor} style={{ width: "18px", height: "18px", borderRadius: "50%", objectFit: "cover", flexShrink: 0, display: "block" }} />
    {vendor}
  </button>
)

export const CurlExplorer = () => {
  const [curlsData, setCurlsData] = useState([])
  const [vendorsIcons, setVendorsIcons] = useState({})
  const [loading, setLoading] = useState(true)
  const [template, setTemplate] = useState("")
  const [selectedModel, setSelectedModel] = useState("")
  const [activeScene, setActiveScene] = useState("")
  const [activeLabel, setActiveLabel] = useState("")

  useEffect(() => {
    fetch("/models_curl.txt")
      .then(r => r.json())
      .then(raw => {
        const icons = {}
        raw.forEach(d => { if (!icons[d.vendor]) icons[d.vendor] = d.icon })
        const curls = raw.map(d => ({
          t: d.vendor, m: d.model, s: d.scene, u: d.url,
          ls: d.labels.map(lb => ({ l: lb.label, c: lb.curls.map(c => ({ n: c.name, v: c.value })) }))
        }))
        setVendorsIcons(icons)
        setCurlsData(curls)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const allVendors = useMemo(() => [...new Set(curlsData.map(d => d.t))].sort(), [curlsData])

  const models = useMemo(() => {
    if (!template) return []
    return [...new Set(curlsData.filter(d => d.t === template).map(d => d.m))].sort()
  }, [template, curlsData])

  const modelRecords = useMemo(() => {
    if (!template || !selectedModel) return []
    return curlsData.filter(d => d.t === template && d.m === selectedModel)
  }, [template, selectedModel, curlsData])

  const scenes = useMemo(() => modelRecords.map(r => r.s), [modelRecords])

  const currentRecord = useMemo(() => {
    if (!modelRecords.length) return null
    return modelRecords.find(r => r.s === activeScene) || modelRecords[0]
  }, [modelRecords, activeScene])

  const labels = useMemo(() => currentRecord ? currentRecord.ls.map(item => item.l) : [], [currentRecord])

  const currentLabelData = useMemo(() => {
    if (!currentRecord) return null
    return currentRecord.ls.find(item => item.l === activeLabel) || currentRecord.ls[0]
  }, [currentRecord, activeLabel])

  const handleVendorClick = (t) => { setTemplate(t); setSelectedModel(""); setActiveScene(""); setActiveLabel("") }
  const handleModelClick = (m) => { setSelectedModel(m); setActiveScene(""); setActiveLabel("") }
  const handleSceneClick = (s) => { setActiveScene(s); setActiveLabel("") }

  const scrollStyle = { overflowY: "auto", scrollbarWidth: "thin", scrollbarColor: "#e2e8f0 transparent" }
  const sectionLabel = { fontSize: "11px", fontWeight: 700, color: "#0D9373", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "10px" }

  if (loading) return (
    <div style={{ fontFamily: "inherit", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "60px", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: "13px" }}>
      Loading...
    </div>
  )

  return (
    <div style={{ fontFamily: "inherit", border: "1px solid #e2e8f0", borderRadius: "12px", overflow: "hidden" }}>
      <style>{".ce-scroll::-webkit-scrollbar{width:3px;height:3px}.ce-scroll::-webkit-scrollbar-track{background:transparent}.ce-scroll::-webkit-scrollbar-thumb{background:#e2e8f0;border-radius:4px}"}</style>

      {/* Section 1: Vendor */}
      <div style={{ padding: "16px 20px", borderBottom: "1px solid #f1f5f9", maxHeight: "180px", display: "flex", flexDirection: "column" }}>
        <div style={sectionLabel}>1 · Vendor</div>
        <div className="ce-scroll" style={{ ...scrollStyle, flex: 1, minHeight: 0, display: "flex", flexWrap: "wrap", gap: "6px", alignContent: "flex-start", alignItems: "flex-start" }}>
          {allVendors.map(v => (
            <VendorButton key={v} vendor={v} icon={vendorsIcons[v]} active={template === v} onClick={() => handleVendorClick(v)} />
          ))}
        </div>
      </div>

      {/* Section 2: Model */}
      <div style={{ padding: "16px 20px", borderBottom: "1px solid #f1f5f9", maxHeight: "180px", display: "flex", flexDirection: "column" }}>
        <div style={sectionLabel}>
          2 · Model
          {template && <span style={{ color: "#cbd5e1", fontWeight: 400, textTransform: "none", letterSpacing: 0, marginLeft: "6px" }}>{models.length} models</span>}
        </div>
        {template ? (
          <div className="ce-scroll" style={{ ...scrollStyle, flex: 1, minHeight: 0, display: "flex", flexWrap: "wrap", gap: "6px", alignContent: "flex-start" }}>
            {models.map(m => (
              <TagButton key={m} label={m} active={selectedModel === m} onClick={() => handleModelClick(m)} />
            ))}
          </div>
        ) : (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: "13px" }}>Select a vendor above</div>
        )}
      </div>

      {/* Section 3: Curl */}
      <div>
        <div style={{ padding: "12px 20px", borderBottom: "1px solid #f1f5f9" }}>
          <div style={{ ...sectionLabel, marginBottom: "8px" }}>3 · Curl Examples</div>
          <div style={{ minHeight: "28px", display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            {selectedModel && scenes.length > 1 && scenes.map(s => (
              <TabBtn key={s} label={s} active={(activeScene || scenes[0]) === s} onClick={() => handleSceneClick(s)} />
            ))}
            {selectedModel && labels.length > 1 && (
              <>
                {scenes.length > 1 && <span style={{ color: "#e2e8f0", margin: "0 2px" }}>|</span>}
                {labels.map(l => (
                  <TabBtn key={l} label={l} active={(activeLabel || labels[0]) === l} onClick={() => setActiveLabel(l)} />
                ))}
              </>
            )}
            {selectedModel && labels.length === 1 && labels[0] && (
              <>
                {scenes.length > 1 && <span style={{ color: "#e2e8f0", margin: "0 2px" }}>|</span>}
                <TabBtn label={labels[0]} active={true} onClick={() => {}} />
              </>
            )}
          </div>
        </div>

        <div style={{ padding: selectedModel ? "20px" : "0 20px 20px" }}>
          {selectedModel && currentLabelData ? (
            <>
              {currentLabelData.c.map((curl, i) => <CurlBlock key={i} curl={curl} />)}
              {currentRecord?.u && (
                <div style={{ marginTop: "8px", paddingTop: "16px", borderTop: "1px solid #f1f5f9" }}>
                  <a href={currentRecord.u} target="_blank" rel="noreferrer" style={{ fontSize: "13px", color: "#0D9373", textDecoration: "none" }}>
                    View Full Documentation →
                  </a>
                </div>
              )}
            </>
          ) : (
            <div style={{ padding: "40px 0", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: "13px" }}>
              Select a model to view curl examples
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
