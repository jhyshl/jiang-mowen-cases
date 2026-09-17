import professorSource from './professor.source.json' with {type:'json'};
import linSource from './lin.source.json' with {type:'json'};

const norm = s => String(s).replaceAll('陈丽娟','陈美娟').replaceAll('林晓女','林小女').replaceAll('杨耀祥','杨耀翔').replaceAll('何登峰','何登锋');
const privateSource=source=>({background:norm(source.caseDetails),cast:Object.fromEntries(Object.entries(source.suspects).map(([id,p])=>[id,{name:norm(p.name),details:norm(p.details)}])),truth:norm(source.canon.match(/<案件真相>([\s\S]*?)<\/案件真相>/)?.[1]||'')});
const req = (...ids) => ids.map(id => ({id,stage:'resolved'}));
const known = (...ids) => ids.map(id => ({id,stage:'found'}));
function fact(id,label,text,requires=[],trigger='',kind='observation') {
  return {id,label,kind,requires,trigger,stages:[{key:'resolved',text:norm(text)}]};
}
function item(source,id,found,requires=[],delayTurns=2,delayMinutes=0,trigger='') {
  const original=source.evidence[id];
  return {id,label:original.name,kind:'physical',requires,trigger,delayTurns,delayMinutes,stages:[
    {key:'found',text:found},
    {key:'submitted',text:`${original.name}已登记送检，尚无鉴定结论。`},
    {key:'resolved',text:norm(original.details)}
  ]};
}
const testimony=(source,id,requires=[],trigger='',override)=>fact(id,source.evidence[id].name,override||source.evidence[id].details,requires,trigger,'testimony');

const professorNodes=[
  fact('scene','公寓现场','北城幸福花园小区的莫非墨（63岁）、陶婉珺（60岁）夫妇被发现死于家中。门锁有撬压痕，屋内柜体遭翻动。莫非墨倒在客厅，陶婉珺倒在卧室门后。死因、凶器及作案人数尚待调查。',[],'到场、勘查或核查报案'),
  fact('ev_crime_scene','现场勘查记录',professorSource.evidence.ev_crime_scene.details,req('scene'),'细查现场并与家属核对遗失财物'),
  item(professorSource,'ev_autopsy_report','两名死者遗体已发现；需要登记安排尸检，尚无死因和伤口数量结论。',req('scene'),0,180,'要求尸检或联系法医'),
  item(professorSource,'ev_bloody_footprints','地面可见多处血鞋印，可以提取鞋印样本；尚不知具体人数、鞋型和尺码。',req('scene'),1,0,'检查地面、足迹或鞋印'),
  fact('ev_cctv_footage','监控录像','10月20日凌晨，监控记录三名身影撬门进入，一小时后换装离开。其中一人提着两个大袋子，把其中一个扔进楼下垃圾箱。监控画面本身不能直接提供三人的姓名。',req('scene'),'调取并查看出入口监控'),
  item(professorSource,'ev_bloody_clothes','在楼下垃圾箱内找到三套沾血衣物；血液来源尚待鉴定。',req('ev_cctv_footage'),2,0,'主动搜查监控对应垃圾箱'),
  item(professorSource,'ev_murder_weapon','展开弃置衣物时发现一把沾血水果刀；刀具与伤口是否对应、指纹属于谁均未确定。',known('ev_bloody_clothes'),2,0,'展开衣物、检查包裹或搜查凶器'),
  testimony(professorSource,'ev_neighbor_testimony_1',req('scene'),'向邻居询问日常关系和是否结仇'),
  testimony(professorSource,'ev_neighbor_testimony_2',req('scene'),'向邻居询问出行、返家和近期活动'),
  fact('identities','监控人员身份核查','排查确认监控中的三名少年为：何子杰（16岁）、梁斌（15岁）、李自微（14岁）。他们曾在同一所初中读书，现已辍学。此时不能仅凭身份核查确认各人的具体行为和责任。',req('ev_cctv_footage'),'对照监控排查、身份核实、追查网吧'),
  fact('ev_suspect_trail','嫌疑人的行动轨迹',professorSource.evidence.ev_suspect_trail.details,req('identities'),'追查三人轨迹、核对相关盗窃报案'),
  fact('li_first','李自微：初次接触','李自微显得畏缩，害怕何子杰和梁斌，谈到家人时情绪明显变化；尚未交代案件经过。',req('identities'),'询问李自微','testimony'),
  fact('li_statement','李自微的供述','在依法保障其安全、明确保护其免受同伙报复后，李自微供称：三人本为偷东西入室，何子杰率先持刀，梁斌加入搏斗，自己受到何子杰死亡威胁后也被迫动手；事后换下衣服处理。他的说法仍需与物证核对。',req('li_first'),'继续询问李自微并提供保护，禁止承诺免罪','testimony'),
  fact('liang_first','梁斌：初次询问','梁斌态度强硬，要求找律师，拒绝交代。他尚未承认或描述具体作案过程。',req('identities'),'询问梁斌','testimony'),
  fact('liang_statement','梁斌的供述','面对监控等证据，梁斌开始推卸责任，把主要责任推给何子杰。这是利害关系人的说法，不能当作未经核实的案情全貌。',req('liang_first','ev_cctv_footage'),'向梁斌出示已掌握的证据并追问','testimony'),
  fact('he_first','何子杰：初次询问','何子杰对询问保持冷淡、否认或沉默，未承认持刀行为。',req('identities'),'询问何子杰','testimony'),
  fact('he_statement','何子杰的供述','被出示水果刀上的本人指纹后，何子杰无法再否认接触凶器，转而强调梁斌也参与动手，企图分散责任。具体责任仍须结合各项证据核实。',req('he_first','ev_murder_weapon','identities'),'向何子杰出示凶器指纹并追问','testimony'),
  fact('truth','证据链复盘','现有证据支持：三人误以为屋内无人，撬门盗窃时遇上已返家的莫氏夫妇。莫非墨试图报警时遭何子杰持刀袭击，梁斌加入；何子杰又胁迫李自微对陶婉珺动手。三人搜刮财物、更换衣物后离开，弃置血衣及凶器。陶婉珺重伤后曾试图爬行求救。各人行为与供述仍应逐项对证，最终法律认定交由后续程序；不要编造判刑结果。',req('ev_autopsy_report','ev_crime_scene','ev_bloody_footprints','ev_cctv_footage','ev_bloody_clothes','ev_murder_weapon','ev_neighbor_testimony_2','li_statement','he_statement'),'玩家主动提交整体推理、要求复盘并与已知证据相符','conclusion')
];
// A fingerprint name is released only after the comparison reference is identified.
professorNodes.find(n=>n.id==='ev_murder_weapon').resultRequires=req('identities');

const linNodes=[
  fact('scene','打捞与身份确认','枫林小区6栋天台蓄水池发现人体残肢。经打捞及身份核查，死者为该楼702室住户林小女，71岁。尸体受浸泡，死亡原因、死亡时间及肢解时间均待法医鉴定。',[],'到场、组织打捞并核实死者身份'),
  fact('household','家庭及照护关系','林小女独居，由陈美娟（54岁）照护。女儿杨文丽（48岁，医生），女婿何登锋（49岁），外孙女何安然与外孙何安佑（21岁双胞胎）；儿子杨谦友（46岁，商人），孙子杨耀翔（18岁）。亲属身份本身不能作为犯罪证据。',req('scene'),'走访、查户籍或了解家庭照护关系'),
  fact('apartment','702室初步勘查','702室整体整洁，卧室、厨房、客厅未见大量血迹。厨房有普通家用刀具，表面整洁；浴室需要进行进一步痕迹检查。天台门锁无明显暴力破坏痕迹。不能由此直接确定分尸地点或熟人身份。',req('scene'),'进入702室勘查'),
  item({evidence:{bathroom_trace:{name:'浴室痕迹检验',details:'浴室地漏和瓷砖缝隙检出被清洗过的血迹，支持浴室曾发生涉血活动；需结合其他检验和供述判断性质。'}}},'bathroom_trace','浴室地漏和瓷砖缝隙已被清洁，可以采集痕迹样本；肉眼不能下鉴定结论。',req('apartment'),1,0,'检查浴室或提取隐蔽痕迹'),
  item(linSource,'ev_autopsy_report','遗体已发现；需登记安排尸检，尚无死因和时间结论。',req('scene'),0,180,'要求尸检、安排法医检验'),
  item(linSource,'ev_bone_knife','厨房刀架内侧放着一把常见家用重型斩骨刀，外表干净；尚不能断言与案件有关。',req('apartment'),3,0,'细查厨房刀具、提取刀具'),
  fact('ev_cctv_footage','楼道监控',linSource.evidence.ev_cctv_footage.details,req('household'),'调取并查看楼道监控'),
  fact('ev_transport_record','陈美娟的交通记录','交通记录显示陈美娟11日离开，13日晚返回市区，14日凌晨乘最早班车回乡。这与她一直在乡下的说法存在矛盾；记录本身不能证明她杀人或分尸。',req('household'),'核对陈美娟的票务、班车和返城记录'),
  fact('ev_insurance_policy','高额投保单',linSource.evidence.ev_insurance_policy.details,req('household'),'调查保险、遗产或调取保单'),
  item(linSource,'ev_bloody_shoes','保姆房床底发现一双旧运动鞋，鞋底缝隙有待检痕迹；尚不知是否来自死者。',req('apartment','household'),2,0,'搜查保姆房、床底或鞋子'),
  testimony(linSource,'ev_neighbor_a_testimony',req('scene'),'向邻居询问争吵或12日动静'),
  testimony(linSource,'ev_neighbor_b_testimony',req('scene'),'向邻居了解家庭日常与照顾情况'),
  testimony(linSource,'ev_wenli_testimony',req('household'),'询问杨文丽12日到访及争吵', '杨文丽承认因母亲打算把财产留给杨耀翔而争吵，称离开时母亲坐在床边喘气，自己随手带上卧室门。这是她对当时情况的说法；是否与死因相关要等鉴定。'),
  testimony(linSource,'ev_qianyou_testimony_1',req('household'),'询问杨谦友12日到访的目的'),
  testimony(linSource,'ev_qianyou_testimony_2',req('ev_qianyou_testimony_1','ev_cctv_footage'),'继续追问杨谦友在小区滞留及具体去向','杨谦友称自己这几天在同小区一名与自己有情人关系的女大学生家中。这是待核实的不在场说法，不能直接宣布其已排除嫌疑；原案未给出完整独立旁证，禁止虚构旁证。'),
  testimony(linSource,'ev_meijuan_testimony_1',req('household'),'传唤或询问陈美娟'),
  fact('meijuan_pressure','陈美娟：证据质询','同时面对交通记录和鞋底鉴定结果，陈美娟的说法出现明显困难，哭泣、发抖，仍挣扎否认。此次只允许表现心理防线动摇，尚不交代完整经过。',req('ev_meijuan_testimony_1','ev_transport_record','ev_bloody_shoes'),'同时出示交通记录与鞋底检验结果追问陈美娟','testimony'),
  testimony(linSource,'ev_meijuan_confession',req('meijuan_pressure','ev_transport_record','ev_bloody_shoes'),'在上一轮证据质询后继续依法询问陈美娟','陈美娟供称：13日晚回雇主家拿私房钱，发现老人死在卧室，因害怕被指责和愚昧恐惧，在浴室使用厨房斩骨刀分尸，分次投入天台蓄水池，14日凌晨回乡。她坚持没有杀人；这属于供述，死因与时间要以鉴定相互核验。'),
  fact('care_background','照護与家事核查','陈美娟的工资由杨文丽与杨谦友各付一半。她11日下午因孙子生病需要照看，怕请假遭拒或被扣钱，与林小女商议后留下三天饭菜回乡。何安然平日关心外婆。家庭关系只能作为背景，不能据此判断有罪。',req('household'),'核实保姆请假原因、照护安排或向何安然走访'),
  fact('truth','证据链复盘','现有尸检、交通记录、痕迹物证和供述可拼合出：林小女12日与女儿因财产问题争吵后独自在卧室心肌梗死；杨谦友随后取走资料，未发现卧室异常；陈美娟13日晚返回发现遗体，因恐惧和愚昧实施分尸藏尸，14日回乡。应分别讨论死因、尸体处理和每份证词的证明范围，不把情绪或偏心当成杀人证据，也不虚构判决。',req('ev_autopsy_report','ev_bone_knife','bathroom_trace','ev_cctv_footage','ev_transport_record','ev_bloody_shoes','ev_wenli_testimony','ev_qianyou_testimony_1','ev_meijuan_confession'),'玩家主动提出完整推理、复盘并与证据一致','conclusion')
];

// Bodies have already been found at 'scene'; arranging an autopsy directly registers
// a pending service instead of making the player discover the same body twice.
for(const nodes of [linNodes,professorNodes]) {
  const report=nodes.find(n=>n.id==='ev_autopsy_report');
  report.stages=report.stages.slice(1);
}

export const cases=[
  {id:'lin',sourceId:linSource.caseId,title:'林小女案',name:linSource.caseName,version:1,date:'2025年9月15日',start:'枫林小区物业报案：6栋住户投诉自来水腥臭、泛红，物业在天台蓄水池发现人体残肢。警方准备前往现场；身份、死因及经过均未确定。',nodes:linNodes,privateSource:privateSource(linSource),
    privateNotes:'以细节修正为准，保姆标准姓名陈美娟，别名陈丽娟；杨耀翔、何登锋、林小女为统一写法。死者死在卧室，分尸在浴室；厨房与卧室无大片血迹。陈美娟11日离开是孙子生病，不是奔丧；人物谎称与已查证事实必须分开。原案中杨谦友的不在场说法缺少独立旁证，不得伪造证明。原始案底仅供副API裁定，禁止转抄给主API。'},
  {id:'professor',sourceId:professorSource.caseId,title:'教授夫妇案',name:professorSource.caseName,version:1,date:'2025年10月20日',start:'莫钰联系不上住在北城幸福花园小区的父母，委托邻居查看后报警。警方接到报案，准备前往核实现场。此时尚无现场勘查或身份核查结果。',nodes:professorNodes,privateSource:privateSource(professorSource),
    privateNotes:'原案的少年身份、动机和完整经过不能提前透出。嫌疑人均未成年；询问应有相应程序保障，不得刑讯、许诺免罪或凭心理侧写定罪。家庭背景：何子杰父母离异、被忽视；梁斌受溺爱；李自微家境困难，父亲失明，母亲严重精神障碍，由奶奶支撑，长期受霸凌。只有实际调查或其本人被询问才可谈对应背景，默认不可自动发放。'}
];
export const caseById=id=>cases.find(c=>c.id===id);
