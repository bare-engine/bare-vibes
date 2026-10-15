const fs=require('node:fs'),path=require('node:path'),ts=require('typescript');let files=JSON.parse(fs.readFileSync('.tmp/all-wait-files.json'));const root=path.resolve('..');
function update(relative,fn){const f=files.find(f=>f.relative===relative.replace(/\//g,'\\'));if(!f)throw Error('Missing staged '+relative);const old=fs.readFileSync(f.stage,'utf8'),eol=old.includes('\r\n')?'\r\n':'\n';fs.writeFileSync(f.stage,fn(old.replace(/\r\n/g,'\n')).replace(/\n/g,eol));}
function add(relative){const source=path.join(root,relative),stage=path.resolve('.tmp/all-waits',relative);fs.mkdirSync(path.dirname(stage),{recursive:true});fs.copyFileSync(source,stage);const project=path.dirname(path.dirname(source));files.push({project,file:path.relative(project,source),relative:relative.replace(/\//g,'\\'),stage});}
function method(s,name,fn){const sf=ts.createSourceFile('probe.ts',s,ts.ScriptTarget.Latest,true);let n;function walk(node){if(ts.isMethodDeclaration(node)&&node.name.getText(sf)===name)n=node;ts.forEachChild(node,walk);}walk(sf);if(!n)throw Error('Missing method '+name);return s.slice(0,n.getStart(sf))+fn(s.slice(n.getStart(sf),n.getEnd()))+s.slice(n.getEnd());}
function cleanup(s,wait,target){const old=`if (!await ${wait})\n            return;\n        ${target} = false;`;if(!s.includes(old))throw Error('Missing cleanup '+wait);return s.replace(old,`try\n        {\n            await ${wait};\n        }\n        finally\n        {\n            ${target} = false;\n        }`);}
update('BareDemosCollection/bare-rpg/src/components/playerComponents.ts',s=>cleanup(s,'this.scene.Wait(.4, true)','this.stunned'));
update('BareDemosCollection/bare-rpg/src/objects/weapon.ts',s=>{
 s=cleanup(s,'this.scene.Wait(.05, true)','this.physicsHitbox.active');
 return s.replace('if (!await this.scene.WaitFrame())\n            return;\n        this.physicsHitbox.active = false;','const completed = await this.scene.WaitFrame();\n        this.physicsHitbox.active = false;\n        if (!completed)\n            return;');
});
update('emojiWorld/src/components/playerComponent.ts',s=>cleanup(s,'this.scene.Wait(.05, true)','this.weapon.physicsHitbox.active'));
for(const file of ['BareDemosCollection/bare-rpg/src/components/enemyAIComponent.ts','emojiWorld/src/components/enemyAIComponent.ts'])update(file,s=>s.replace('if (!await this.scene.WaitFrame())\n            return;','const completed = await this.scene.WaitFrame();').replace("this.go.events.offAlias('hitCheck');","this.go.events.offAlias('hitCheck');\n        if (!completed)\n            return;"));
update('BareMetroidvania/src/components/playerComponent.ts',s=>s.replace('if (!await this.scene.Wait(0.3, true))\n            return;', 'if (!await this.scene.Wait(0.3, true))\n        {\n            this.controlsLocked = false;\n            return;\n        }'));
update('emojiWorld/src/components/goalComponent.ts',s=>{
 s=method(s,'handleDiamondLockCollision',body=>body.replace(/if \(!await this\.scene\.Wait\(([^\n]+)\)\)\n(\s*)return;/g,(_,args,indent)=>`if (!await this.scene.Wait(${args}))\n${indent.slice(4)}{\n${indent}game.player.static = false;\n${indent}this.paymentInProgress = false;\n${indent}return;\n${indent.slice(4)}}`));
 s=method(s,'processCompletionResult',body=>body.replace('Promise<void>','Promise<boolean>').replace('if (!this.result) return;','if (!this.result) return true;').replace('if (!await this.scene.Wait(.75))\n            return;','if (!await this.scene.Wait(.75))\n        {\n            game.player.static = false;\n            return false;\n        }').replace(/\n    }$/, '\n        return true;\n    }'));
 s=s.replace('await this.processCompletionResult();','if (!await this.processCompletionResult())\n            return;');
 return s.replace('//await wait(750);','//await this.scene.Wait(750);');
});
update('BareVamireSurvivors/src/systems/benchmark.ts',s=>{
 s=s.replace('spawner: game.spawner.enabled,','spawner: game.spawner.enabled,\n            autopilot: game.autopilot,');
 const start=s.indexOf('        for (const mode of modes)');const end=s.indexOf('        game.combat.SetMode(saved.mode);',start);
 let loop=s.slice(start,end).trimEnd().split('\n').map(l=>'    '+l).join('\n');
 const restoreEnd=s.indexOf('        window.benchResults',end);
 let restore=s.slice(end,restoreEnd).replace('game.autopilot = false;','game.autopilot = saved.autopilot;').replace("this.status = 'Benchmark done, results in the console';", "this.status = completed ? 'Benchmark done, results in the console' : 'Benchmark cancelled';").trimEnd().split('\n').map(l=>'    '+l).join('\n');
 loop=loop.replace('perf.BeginSample();','perf.BeginSample();\n                    sampling = true;').replace('const stats = perf.EndSample();','const stats = perf.EndSample();\n                    sampling = false;');
 return s.slice(0,start)+'        let completed = false;\n        let sampling = false;\n        try\n        {\n'+loop+'\n            completed = true;\n        }\n        finally\n        {\n            if (sampling) perf.EndSample();\n'+restore+'\n        }\n\n'+s.slice(restoreEnd);
});
for(const project of ['BareTrust','PrisonersDilemma']){
 add(project+'/src/game.ts');
 update(project+'/src/peep.ts',s=>method(s,'PlayMove',body=>body.replace('Promise<void>','Promise<boolean>').replace(/return;/g,'return false;').replace(/\n    }$/, '\n        return true;\n    }')));
 update(project+'/src/game.ts',s=>s.replace('await Promise.all([\n            this.player.PlayMove','const completed = await Promise.all([\n            this.player.PlayMove').replace('this.playingRound = false;\n        this.DehighlightPayoff();','this.playingRound = false;\n        if (!completed.every(Boolean))\n            return;\n        this.DehighlightPayoff();'));
}
fs.writeFileSync('.tmp/all-wait-files.json',JSON.stringify(files,null,2));console.log('Refined cancellation and cleanup in staged files.');
