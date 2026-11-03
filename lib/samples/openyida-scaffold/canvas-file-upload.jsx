import React from 'react';

// Merge into the business page. value contains confirmed files, never File objects.
// Use accept="image/*" for pictures; accept only guides the picker.
// Save AttachmentField and ImageField as file-object arrays, never URL arrays.
function CanvasFileUpload({ binding, value = [], onChange, onUploadingChange, accept, maxBytes, disabled = false }) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const [pending, setPending] = React.useState(null);
  const [api, setApi] = React.useState(() => window.__OPENYIDA_FILE_API__);
  const locked = React.useRef(false);
  const incomplete = React.useRef(false);
  React.useEffect(() => {
    if (api) return;
    const timer = setInterval(() => {
      if (window.__OPENYIDA_FILE_API__) {
        setApi(window.__OPENYIDA_FILE_API__);
        clearInterval(timer);
      }
    }, 200);
    return () => clearInterval(timer);
  }, [api]);

  async function selectFiles(event) {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length || locked.current || incomplete.current || disabled) return;
    locked.current = true;
    setBusy(true);
    if (onUploadingChange) onUploadingChange(true);
    setError('');
    const next = value.slice();
    try {
      if (!api) throw new Error('上传服务未就绪，请刷新页面');
      for (const file of files) {
        let uploaded;
        try {
          uploaded = await api.upload(binding, file, { maxBytes });
        } catch (failure) {
          if (!failure.uploadedFile) throw failure;
          // Confirm succeeded: retry only the URL step, not the upload.
          incomplete.current = true;
          setPending(failure.uploadedFile);
          throw failure;
        }
        next.push(uploaded);
        onChange(next.slice());
      }
    } catch (failure) {
      setError(failure.code === 'FILE_LOGIN_REQUIRED' ? '请登录后上传附件或图片' : failure.message);
    } finally {
      locked.current = false;
      setBusy(false);
      if (onUploadingChange) onUploadingChange(incomplete.current);
    }
  }

  async function retryDownload() {
    if (!pending || locked.current || disabled) return;
    locked.current = true;
    setBusy(true);
    if (onUploadingChange) onUploadingChange(true);
    try {
      const urls = await api.getDownloadUrl(binding, pending.objectName);
      onChange(value.concat(Object.assign({}, pending, urls)));
      setPending(null);
      incomplete.current = false;
      setError('');
    } catch (failure) {
      setError(failure.message);
    } finally {
      locked.current = false;
      setBusy(false);
      if (onUploadingChange) onUploadingChange(incomplete.current);
    }
  }

  return <div aria-busy={busy} style={{ color: 'var(--color-text1-4)' }}>
    <label>选择附件或图片 <input type="file" multiple accept={accept}
      disabled={disabled || busy || !!pending || !api} onChange={selectFiles} /></label>
    {busy && <p role="status">正在上传，请稍候再提交</p>}
    {!api && <p role="alert">上传服务未就绪，请刷新页面</p>}
    {error && <p role="alert">{error}</p>}
    {pending && <p>文件已上传，获取地址失败。
      <button type="button" disabled={disabled || busy} onClick={retryDownload}>重试获取地址</button>
      <button type="button" disabled={disabled || busy} onClick={() => {
        incomplete.current = false;
        setPending(null);
        setError('');
        if (onUploadingChange) onUploadingChange(false);
      }}>移除</button>
    </p>}
    <ul>{value.map((file, index) => <li key={file.objectName}>
      <a href={file.downloadUrl} target="_blank" rel="noopener noreferrer">{file.name}</a>
      {file.previewUrl && <a href={file.previewUrl} target="_blank" rel="noopener noreferrer">预览</a>}
      <button type="button" disabled={disabled || busy}
        onClick={() => onChange(value.filter((_, i) => i !== index))}>移除</button>
    </li>)}</ul>
  </div>;
}

// After saveFormData/updateFormData/startProcessInstance succeeds, pass the
// actual returned instance ID. Keep that ID on failure and retry this action only.
async function bindSavedFiles(binding, savedInstId, files) {
  return window.__OPENYIDA_FILE_API__.bindFiles(binding, savedInstId, files);
}
