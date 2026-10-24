https://oi-wiki.org/graph/tree-basic/
https://labuladong.online/zh/algo/data-structure-basic/binary-tree-traverse-basic/
# 存储
## 邻接表
### 无根树 
为每个结点开一个线性列表，记录所有与之相连接的结点
```cpp
vecotor<int>adj[N]
```
### 有根树
1. 若无向图, 可同上
2. 若输入数据能确保结点的上下关系, 利用这一点, 为每个结点开一个线性列表, 记录其所有子结点, 若必要, 再加一个数组记录其父结点
```cpp
vector<int>children[N]
int parent[N]
```

## 左孩子右兄弟
对于有根树的简单表示方法
首先 给每个结点的所有子结点任意确定一个顺序
然后 每个结点记录2个值
	1. 其第一个子结点child u
	2. 其下一个兄弟结点 sib u
遍历一个结点的所有子结点，方法:
	从第一个子结点开始
		处理每个子结点
		转移到下一个兄弟结点
```cpp
int v=child[u]
while(v!=EMPTY_NODE){
	//....
	v=sib[v]
}

```
## 二叉树
需要记录每个结点的左右子结点
```cpp
int parent[N]
int lch[N],rch[N]
```

DFS遍历
先 中 后序
![[95308acbda8ce43e8c246269377a7df0.jpg]]
先序遍历
根->左->右
```cpp
void preorder(BitTree* root){
	if(root){
		cout<<root->key<<" ";
		preorder(root->left)
		preorder(root->right)
	}
}
```
中序
左根右
后序
左右根
已知中序遍历序列和另外一个序列可以求第三个序列．

![reverse](https://oi-wiki.org/graph/images/tree-basic-reverse.svg)

1. 前序的第一个是 `root`，后序的最后一个是 `root`．
2. 先确定根节点，然后根据中序遍历，在根左边的为左子树，根右边的为右子树．
3. 对于每一个子树可以看成一个全新的树，仍然遵循上面的规律．![[Screenshot 2026-10-24 at 02.03.17.png]]
递归遍历/层序遍历
递归遍历 衍生 DFS
层序遍历 衍生 BFS
递归遍历二叉树的顺序是固定的，但是有三个关键位置，在不同位置插入代码，会产生不同的效果
层序遍历顺序也固定，但是三种写法
递归遍历
```cpp
class Node{
public:
	int val;
	Node* left;
	Node* right;
	Node(int x):val(x),left(nullptr),right(nullptr){}
};
void traverse(Node* root){
	if(root==nullptr)return;
	//前序位置
	traverse(root->left);
	//中序位置
	traverse(root->right);
	//后序位置
}
```
递归遍历的顺序 函数访问结点的顺序确实是固定的
![[95308acbda8ce43e8c246269377a7df0 1.jpg]]
在traverse中不同位置放代码
即 三种位置的关键在于执行时机的不同

- 二叉搜索树的中序遍历，结果是有序的
![[Screenshot 2026-10-24 at 02.13.49.png]]
## 层序遍历
![[Pasted image 20261024021459.png]]
### 写法一
```cpp
void traverse(Node* root){
	if(root==nullptr)return;
	queue<Node*>q;
	q.push(root);
	while(!q.empty()){
		Node* cur=q.front()
		q.pop()
		cout<<cur->val<<endl;
	}
	if(cur->left!=nullptr)
		q.push(cur->left);
	if(cur->right!=nullptr)
		q.push(cur->right);
}
```
缺点 无法知道当前结点在第几层 简单但不常用
### 写法二
```cpp
void traverse(Node* root){
	if(root==nullptr)return;
	queue<Node*>q;
	q.push(root);
	
	int depth=1;
	
	while(!q.empty()){
		int size=q.size();
		for(int i=0;i<size;i++){
			Node* cur=q.front();
			q.pop();
			cout<<depth<<endl;
			cout<<cur->val<<endl;
			if(cur->left!=nullptr)
				q.push(cur->left);
			if(cur->right!=nullptr)
				q.push(cur->right);
		}
	}
	depth++;
}
```
写法二，每向下一层，depth+1，可以理解为每条边权重为1
如果每条边权重可以为任意值
### 写法三
加一个State类，每个节点自己负责维护自己的路径权重和
```cpp
class State{
public:
	Node* node;
	int depth;
	State(Node* node,int depth):node(node),depth(depth)
};
void traverse(Node* root){
	if(root==nullptr)return;
	queue<State>q;
	q.push(State(root,1));
	
	while(!q.empty()){
		State cur=q.front();
		q.pop();
		cout<<depth<<endl;
		cour<<cur.node->val<<endl;
		if(cur.node->left!=nullptr)
			q.push(cur.node->left,depth+lweight)
		if(cur.node->right!=nullptr)
			q.push(cur.node->right,depth+rweight)
	}
}
```
