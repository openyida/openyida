import React from 'react';
import { Modal } from 'antd';

// 合并进当前 Canvas 页面；通过 open/onOk/onCancel 控制业务状态。
function CanvasDialog({ children, rootClassName = '', ...props }) {
  return (
    <>
      <style>{`
        .openyida-dialog .ant-modal-mask {
          background: var(--color-calculate-mask-background, rgba(0, 0, 0, 0.35));
        }
        .openyida-dialog .ant-modal-content {
          padding: 0;
          overflow: hidden;
          background: var(--dialog-bg, var(--pod-card-bg-color, var(--color-white, #fff)));
          color: var(--dialog-content-color, var(--color-text1-4, #1f2329));
          border: var(--dialog-border-width, 0px) var(--dialog-border-style, solid) var(--dialog-border-color, transparent);
          border-radius: var(--dialog-corner, var(--pod-card-border-radius, 12px));
          box-shadow: var(--dialog-shadow, 0 10px 28px -2px rgba(0, 0, 0, 0.24));
        }
        .openyida-dialog .ant-modal-header {
          margin: 0;
          padding: var(--dialog-title-padding-top, 20px) var(--dialog-title-padding-left-right, 24px) var(--dialog-title-padding-bottom, 16px);
          padding-right: max(56px, var(--dialog-title-padding-left-right, 24px));
          background: var(--dialog-title-bg-color, transparent);
          border-bottom: var(--dialog-title-border-width, 0px) solid var(--dialog-title-border-color, transparent);
        }
        .openyida-dialog .ant-modal-title {
          color: var(--dialog-title-color, var(--dialog-content-color, var(--color-text1-4, #1f2329)));
          font-size: var(--dialog-title-font-size, 16px);
          font-weight: var(--dialog-title-font-weight, 600);
        }
        .openyida-dialog .ant-modal-body {
          color: var(--dialog-content-color, var(--color-text1-4, #1f2329));
          font-size: var(--dialog-content-font-size, 14px);
          padding: var(--dialog-content-padding-top, 8px) var(--dialog-content-padding-left-right, 24px) var(--dialog-content-padding-bottom, 24px);
          max-height: 65vh;
          overflow: auto;
        }
        .openyida-dialog .ant-modal-footer {
          margin: 0;
          padding: var(--dialog-footer-padding-top, 12px) var(--dialog-footer-padding-left-right, 24px) var(--dialog-footer-padding-bottom, 20px);
          background: var(--dialog-footer-bg-color, transparent);
          border-top: var(--dialog-footer-border-width, 0px) solid var(--dialog-footer-border-color, transparent);
        }
        .openyida-dialog .ant-modal-close {
          color: var(--dialog-close-color, var(--color-text1-3, #666));
          top: var(--dialog-close-top, 16px);
          right: var(--dialog-close-right, 16px);
        }
        .openyida-dialog .ant-modal-close:hover {
          color: var(--dialog-close-color-hovered, var(--dialog-title-color, var(--color-text1-4, #1f2329)));
          background: var(--dialog-close-bg-hovered, var(--pod-overlay-color-hover, rgba(83, 88, 97, 0.16)));
        }
        .openyida-dialog .ant-modal-footer .ant-btn + .ant-btn {
          margin-inline-start: var(--dialog-footer-button-spacing, 8px);
        }
        .openyida-dialog .ant-modal-footer .ant-btn-default:not(.ant-btn-dangerous):not(:disabled) {
          color: var(--btn-pure-normal-color, var(--dialog-content-color, var(--color-text1-4, #1f2329)));
          background: var(--btn-pure-normal-bg, var(--dialog-bg, var(--color-white, #fff)));
          border-color: var(--btn-pure-normal-border-color, var(--color-line1-3, #d9d9d9));
        }
        .openyida-dialog .ant-modal-footer .ant-btn-default:not(.ant-btn-dangerous):not(:disabled):hover {
          color: var(--btn-pure-normal-color-hover, var(--color-brand1-6, #1677ff));
          background: var(--btn-pure-normal-bg-hover, var(--color-fill1-2, #f5f5f5));
          border-color: var(--btn-pure-normal-border-color-hover, var(--color-brand1-6, #1677ff));
        }
        .openyida-dialog .ant-modal-footer .ant-btn-primary:not(.ant-btn-dangerous):not(:disabled) {
          color: var(--btn-pure-primary-color, var(--color-white, #fff));
          background: var(--btn-pure-primary-bg, var(--color-brand1-6, #1677ff));
          border-color: var(--btn-pure-primary-border-color, transparent);
        }
        .openyida-dialog .ant-modal-footer .ant-btn-primary:not(.ant-btn-dangerous):not(:disabled):hover {
          color: var(--btn-pure-primary-color-hover, var(--color-white, #fff));
          background: var(--btn-pure-primary-bg-hover, var(--color-brand1-9, #4096ff));
          border-color: var(--btn-pure-primary-border-color-hover, transparent);
        }
        .openyida-dialog .ant-modal-footer .ant-btn-default:not(.ant-btn-dangerous):not(:disabled):active {
          color: var(--btn-pure-normal-color-active, var(--color-brand1-6, #1677ff));
          background: var(--btn-pure-normal-bg-active, var(--color-fill1-3, #eee));
          border-color: var(--btn-pure-normal-border-color-active, var(--color-brand1-6, #1677ff));
        }
        .openyida-dialog .ant-modal-footer .ant-btn-primary:not(.ant-btn-dangerous):not(:disabled):active {
          color: var(--btn-pure-primary-color-active, var(--color-white, #fff));
          background: var(--btn-pure-primary-bg-active, var(--color-brand1-10, #0958d9));
          border-color: var(--btn-pure-primary-border-color-active, transparent);
        }
        .openyida-dialog .ant-modal-footer .ant-btn-dangerous:not(:disabled) {
          color: var(--btn-warning-normal-color, var(--color-error-3, #ff4d4f));
          background: var(--btn-warning-normal-bg, var(--dialog-bg, var(--color-white, #fff)));
          border-color: var(--btn-warning-normal-border-color, var(--color-error-3, #ff4d4f));
        }
        .openyida-dialog .ant-modal-footer .ant-btn-primary.ant-btn-dangerous:not(:disabled) {
          color: var(--btn-warning-primary-color, var(--color-white, #fff));
          background: var(--btn-warning-primary-bg, var(--color-error-3, #ff4d4f));
          border-color: var(--btn-warning-primary-border-color, transparent);
        }
        .openyida-dialog .ant-modal-footer .ant-btn-dangerous:not(:disabled):hover {
          color: var(--btn-warning-normal-color-hover, var(--color-error-3, #ff4d4f));
          background: var(--btn-warning-normal-bg-hover, var(--dialog-bg, var(--color-white, #fff)));
          border-color: var(--btn-warning-normal-border-color-hover, var(--color-error-3, #ff4d4f));
        }
        .openyida-dialog .ant-modal-footer .ant-btn-primary.ant-btn-dangerous:not(:disabled):hover {
          color: var(--btn-warning-primary-color-hover, var(--color-white, #fff));
          background: var(--btn-warning-primary-bg-hover, var(--color-error-3, #ff4d4f));
          border-color: var(--btn-warning-primary-border-color-hover, transparent);
        }
        .openyida-dialog .ant-modal-footer .ant-btn:disabled {
          color: var(--btn-pure-color-disabled, var(--color-text1-1, #bfbfbf));
          background: var(--btn-pure-bg-disabled, var(--color-fill1-1, #f5f5f5));
          border-color: var(--btn-pure-border-color-disabled, var(--color-line1-1, #d9d9d9));
        }
        .openyida-dialog .ant-modal-close:focus-visible,
        .openyida-dialog .ant-modal-footer .ant-btn:focus-visible {
          outline: 2px solid var(--color-brand1-6, #1677ff);
          outline-offset: 2px;
        }
      `}</style>
      <Modal centered maskClosable={false} {...props} rootClassName={`openyida-dialog ${rootClassName}`}>
        {children}
      </Modal>
    </>
  );
}
