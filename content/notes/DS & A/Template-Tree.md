```cpp
struct Node{
	int val;
	Node* left;
	Node* right;
};
Node* p=new Node{1,nullptr,nullptr};
```

```cpp
const N=1009;
int lch[N],rch[N],fa[N];
```

template 1: 输入直接给出父子关系
结点 左孩子 右孩子
要点：要先把所有结点建立出来，再读入连边。题目没有给根的话，根就是那个没有fa的结点
```cpp
struct Node{
	int val;
	Node* parent;
	Node* left;
	Node* right;
};
Node* tree[N];
for(int i=0;i<n;i++)
	tree[i]=new Node{i,nullptr,nullptr};
for(int i=0;i<n;i++){
	int x,y,z;cin>>x>>y>>z;
	if(y!=-1){
		tree[x]->left=tree[y]
		tree[y]->parent=tree[x];
	}
	if(z!=-1){
		tree[x]->right=tree[z]
		tree[z]->parent=tree[x];
	}
}
Node* root=nullptr;
for(int i=0;i<n;i++)
	if(tree[i]->parent==nullptr)
		root=tree[i];
```

```cpp
for(int i=0;i<n;i++)
	lch[i]=rch[i]=fa[i]=-1;
for(int i=0;i<n;i++){
	int x,y,z;cin>>x>>y>>z;
	lch[x]=y;rch[x]=z;
	if(y!=-1)fa[y]=x;
	if(z!=-1)fa[z]=x;
}
int root=-1;
for(int i=0;i<n;i++)
	if(fa[i]==-1)root=i;	
```
template2: 带空标记的先序序列
