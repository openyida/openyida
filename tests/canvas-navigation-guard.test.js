'use strict';

const fs = require('fs');
const path = require('path');
const { assertCanvasNavigationStructure } = require('../lib/app/canvas-navigation-guard');
const { compileCanvasLocal } = require('../lib/app/canvas-compile');
const oldContent = `function CanvasNavigationContent({children}) {
  return <main className="openyida-nav-main" style={{display:'flex', flex:'1 1 0', minHeight:0}}>{children}</main>;
}`;

describe('Canvas navigation source guard', () => {
  test.each([
    "const items=[{key:'home'}]; loadCanvasNavigation({items,appType:'APP'});",
    "const items=[{key:'group',children:[{key:'home',targetType:'local',formUuid:'PAGE'}]}]; filterCanvasNavigation(items, [], [], {mode:'platform'});",
    "loadCanvasNavigation({items:[{key:'home',viewKey:'home',targetType:'local'}],mode:'platform'});",
  ])('blocks known local menus from platform filtering: %s', source => {
    expect(() => assertCanvasNavigationStructure(source, { sourcePath: 'page.canvas.jsx' })).toThrow(expect.objectContaining({
      code: 'OPENYIDA_CANVAS_NAVIGATION_INVALID',
      details: expect.objectContaining({ issueType: 'local_platform', sourcePath: 'page.canvas.jsx', line: 1 }),
    }));
  });
  test.each([
    "loadCanvasNavigation({items:[{key:'home',viewKey:'home',targetType:'local'}],mode:'local'});",
    "loadCanvasNavigation({items:[{key:'home',formUuid:'PAGE'}]});",
    "loadCanvasNavigation({items:[{key:'home',targetType:'local'}],mode:'independent'});",
    'loadCanvasNavigation(config);',
    "const items=[{key:'group',children:items}]; loadCanvasNavigation({items});",
    'loadCanvasNavigation({items:window.items});',
    "loadCanvasNavigation({items:[{key:'home'}],mode:window.mode});",
    "loadCanvasNavigation({items:[{key:'home'}],...window.config});",
    "loadCanvasNavigation({items:[{key:'home',...window.item}]});",
  ])('leaves valid modes and unknown dynamic configuration to runtime: %s', source => {
    expect(() => assertCanvasNavigationStructure(source)).not.toThrow();
  });
  test('old zero-basis flex sample is rejected only when used for a long document page', () => {
    expect(() => compileCanvasLocal(`${oldContent}\nfunction YidaComp(){ return <CanvasNavigationContent layout="document"><p>Long page</p></CanvasNavigationContent>; }`))
      .toThrow(expect.objectContaining({ code: 'OPENYIDA_CANVAS_NAVIGATION_INVALID', details: expect.objectContaining({ issueType: 'document_flex', line: 2 }) }));
    expect(() => compileCanvasLocal(`${oldContent}\nfunction YidaComp(){ return <CanvasNavigationContent layout="workspace"/>; }`)).not.toThrow();
  });
  test.each(['document', 'workspace'])('latest content sample compiles for %s pages', layout => {
    const content = fs.readFileSync(path.join(__dirname, '../lib/samples/openyida-scaffold/canvas-nav/content.jsx'), 'utf8');
    expect(() => compileCanvasLocal(`${content}\nfunction YidaComp(){ return <CanvasNavigationContent layout="${layout}"/>; }`)).not.toThrow();
  });
});
