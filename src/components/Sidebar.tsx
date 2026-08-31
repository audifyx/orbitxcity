import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { OrbitXMark } from "./OrbitXMark";
import { colors } from "../theme";

export type NavRoute = "home"|"trending"|"wallet"|"tools"|"agents"|"activity"|"alerts"|"launch"|"nft"|"paper"|"research"|"strategy"|"social"|"profile"|"settings";
type Conversation = { id: string; title: string; pinned?: boolean };
type NavItem = { route: NavRoute; label: string };
const NAV_LABELS: Record<NavRoute,string> = {home:"Home",trending:"Trending",wallet:"Wallet",tools:"Tools",agents:"Agents",activity:"Activity",alerts:"Alerts",launch:"Launch",nft:"NFT",paper:"Paper",research:"Research",strategy:"Strategy",social:"Social",profile:"Profile",settings:"Settings"};
export const VISIBLE_NAV_ROUTES: readonly NavRoute[] = ["home","wallet","profile","settings"];
const NAV_ITEMS: NavItem[] = VISIBLE_NAV_ROUTES.map((route) => ({route,label:NAV_LABELS[route]}));
export type SidebarProps = { conversations?: Conversation[]; activeId?: string; onNew?:()=>void; onSelect?:(id:string)=>void; onNavigate:(route:NavRoute)=>void; onSearch?:()=>void; activeRoute?:NavRoute; currentPath?:string; onClose?:()=>void; onDeleteConversation?:(id:string)=>void; onPinConversation?:(id:string)=>void };
function routeFromPath(path?:string):NavRoute { if(!path)return "home"; for(const route of VISIBLE_NAV_ROUTES) if(path.includes(route)) return route; if(path.includes("social"))return "social"; return "home"; }
export function Sidebar({conversations=[],activeId,onNew,onSelect,onNavigate,onSearch,activeRoute,currentPath,onClose,onDeleteConversation,onPinConversation}:SidebarProps){
 const resolvedRoute=activeRoute??routeFromPath(currentPath);
 return <View style={styles.root}>
  <View style={styles.brandRow}><OrbitXMark size={22}/><Text style={styles.brandName}>ORBITX</Text></View>
  <Pressable style={styles.primaryBtn} onPress={()=>{onNew?.();onClose?.();}}><Text style={styles.primaryBtnIcon}>+</Text><Text style={styles.primaryBtnLabel}>New Conversation</Text></Pressable>
  <Pressable style={styles.searchBtn} onPress={()=>{onSearch?.();onClose?.();}}><Text style={styles.searchIcon}>⌕</Text><Text style={styles.searchLabel}>Search</Text></Pressable>
  <Text style={styles.sectionLabel}>RECENT</Text>
  <ScrollView style={styles.conversationList} contentContainerStyle={styles.conversationContent} showsVerticalScrollIndicator={false}>
   {conversations.map(c=> <View key={c.id} style={styles.conversationWrap}>
    <Pressable style={({pressed})=>[styles.conversationItem,c.id===activeId&&styles.conversationItemActive,pressed&&styles.pressed]} onPress={()=>{onSelect?.(c.id);onClose?.();}} onLongPress={()=>onPinConversation?.(c.id)} delayLongPress={500}>
     <Text style={[styles.conversationTitle,c.id===activeId&&styles.conversationTitleActive]} numberOfLines={1}>{c.pinned?"◆ ":""}{c.title}</Text>
    </Pressable>
    <View style={styles.chatActions}>
      <Pressable onPress={()=>onPinConversation?.(c.id)}><Text style={styles.actionText}>{c.pinned?"Unpin":"Pin"}</Text></Pressable>
      <Pressable onPress={()=>onDeleteConversation?.(c.id)}><Text style={styles.deleteText}>Delete</Text></Pressable>
    </View>
   </View>)}
  </ScrollView>
  <View style={styles.divider}/>
  <ScrollView style={styles.navList} contentContainerStyle={styles.navContent} showsVerticalScrollIndicator={false}>
   {NAV_ITEMS.map(item=> <Pressable key={item.route} style={[styles.navItem,item.route===resolvedRoute&&styles.navItemActive]} onPress={()=>{onNavigate(item.route);onClose?.();}}><Text style={[styles.navLabel,item.route===resolvedRoute&&styles.navLabelActive]}>{item.label}</Text></Pressable>)}
  </ScrollView>
 </View>;
}
const styles=StyleSheet.create({root:{width:260,flex:1,backgroundColor:colors.ink,borderRightWidth:StyleSheet.hairlineWidth,borderRightColor:colors.line,paddingHorizontal:12,paddingTop:16,paddingBottom:12},brandRow:{flexDirection:"row",alignItems:"center",gap:8,paddingHorizontal:4,marginBottom:18},brandName:{color:colors.frost,fontFamily:"SpaceGrotesk_600SemiBold",fontSize:12,letterSpacing:3.6},primaryBtn:{flexDirection:"row",alignItems:"center",gap:8,minHeight:38,borderRadius:10,borderWidth:StyleSheet.hairlineWidth,borderColor:colors.line,backgroundColor:colors.glass,paddingHorizontal:12,marginBottom:8},primaryBtnIcon:{color:colors.ice,fontSize:16},primaryBtnLabel:{color:colors.frost,fontFamily:"Inter_500Medium",fontSize:13},searchBtn:{flexDirection:"row",alignItems:"center",gap:8,minHeight:34,borderRadius:8,paddingHorizontal:10,marginBottom:16},searchIcon:{color:colors.dim,fontSize:14},searchLabel:{color:colors.dim,fontSize:13},sectionLabel:{color:colors.dim,fontFamily:"Inter_500Medium",fontSize:10,letterSpacing:1.6,paddingHorizontal:6,marginBottom:6},conversationList:{flex:1,maxHeight:260},conversationContent:{gap:4,paddingBottom:8},conversationWrap:{borderRadius:8},conversationItem:{minHeight:34,borderRadius:8,justifyContent:"center",paddingHorizontal:10},conversationItemActive:{backgroundColor:colors.grid},conversationTitle:{color:colors.mist,fontFamily:"Inter_400Regular",fontSize:13},conversationTitleActive:{color:colors.frost,fontFamily:"Inter_500Medium"},chatActions:{flexDirection:"row",gap:14,paddingHorizontal:10,paddingBottom:5},actionText:{color:colors.signal,fontSize:10,fontFamily:"Inter_500Medium"},deleteText:{color:colors.danger,fontSize:10,fontFamily:"Inter_500Medium"},divider:{height:StyleSheet.hairlineWidth,backgroundColor:colors.line,marginVertical:10},navList:{flexShrink:0},navContent:{gap:2},navItem:{minHeight:32,borderRadius:8,justifyContent:"center",paddingHorizontal:10},navItemActive:{backgroundColor:colors.grid},navLabel:{color:colors.dim,fontFamily:"Inter_400Regular",fontSize:13},navLabelActive:{color:colors.frost,fontFamily:"Inter_500Medium"},pressed:{opacity:.72}});
