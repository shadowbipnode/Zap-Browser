interface DownloadItem {
  id:string
  fileName:string
  totalBytes:number
  receivedBytes:number
  state:string
  savePath?:string
}

interface Props {
  downloads: DownloadItem[]
  onClose: () => void
}

function formatBytes(n:number) {
  if (!n || n <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let v = n
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

export default function DownloadsPanel({ downloads, onClose }: Props) {
  return (
    <>
      <div className="panel-hd">
        <span className="panel-hd-title">⬇ Downloads</span>
        <button className="panel-hd-close" onClick={onClose}>×</button>
      </div>

      <div className="panel-body">
        {downloads.length === 0 ? (
          <div style={{fontSize:12,color:'var(--t2)',lineHeight:1.6}}>
            No downloads yet.
          </div>
        ) : downloads.map((d:any) => {
          const pct = d.totalBytes > 0
            ? Math.min(100, Math.round((d.receivedBytes / d.totalBytes) * 100))
            : 0

          const completed = d.state === 'completed'
          const cancelled = d.state === 'cancelled'
          const active = d.state === 'progressing'

          return (
            <div
              key={d.id}
              style={{
                padding:12,
                marginBottom:10,
                background:'var(--bg-3)',
                border:'1px solid var(--b0)',
                borderRadius:'var(--r-md)',
              }}
            >
              <div style={{
                fontSize:12,
                fontWeight:800,
                color:'var(--t0)',
                overflow:'hidden',
                textOverflow:'ellipsis',
                whiteSpace:'nowrap',
                marginBottom:5,
              }}>
                {d.fileName || 'download'}
              </div>

              <div style={{fontSize:11,color:'var(--t2)',marginBottom:8}}>
                {completed
                  ? `Completed · ${formatBytes(d.receivedBytes)}`
                  : cancelled
                    ? 'Cancelled'
                    : `${formatBytes(d.receivedBytes)} / ${formatBytes(d.totalBytes)} · ${pct}%`}
              </div>

              <div style={{
                height:6,
                background:'var(--bg-2)',
                borderRadius:999,
                overflow:'hidden',
                marginBottom:8,
              }}>
                <div style={{
                  width:`${completed ? 100 : pct}%`,
                  height:'100%',
                  background: cancelled ? 'var(--red)' : 'var(--a)',
                  transition:'width .15s ease',
                }} />
              </div>

              {d.savePath && (
                <div style={{
                  fontSize:10,
                  color:'var(--t2)',
                  fontFamily:'var(--mono)',
                  overflow:'hidden',
                  textOverflow:'ellipsis',
                  whiteSpace:'nowrap',
                  marginBottom:8,
                }}>
                  {d.savePath}
                </div>
              )}

              <div style={{display:'flex',gap:8}}>
                {completed && d.savePath && (
                  <>
                    <button className="act-btn" onClick={() => window.zap?.openDownload?.({ path: d.savePath })}>
                      Open
                    </button>
                    <button className="act-btn" onClick={() => window.zap?.showDownloadInFolder?.({ path: d.savePath })}>
                      Show folder
                    </button>
                  </>
                )}

                {active && (
                  <>
                    <span style={{fontSize:11,color:'var(--a)',fontWeight:700}}>
                      Downloading…
                    </span>

                    <button
                      className="act-btn"
                      style={{color:'var(--red)'}}
                      onClick={() => window.zap?.cancelDownload?.({ id: d.id })}
                    >
                      ✕ Cancel
                    </button>
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}
