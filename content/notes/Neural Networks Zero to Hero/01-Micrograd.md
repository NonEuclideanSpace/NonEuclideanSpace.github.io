**Micrograd** is an **automatic differentiation engine** that operates on single numbers rather than tensors, which makes it slow and completely transparent. 
By Katpathy, 目的: 训练神经网络需要知道 loss 函数对每个参数的偏导 $\frac{\partial L}{\partial w}$, 然后梯度下降 $w \leftarrow w - \eta \frac{\partial L}{\partial w}$. 网络较大时, 手推导数不现实.
# 3 Steps Outline
1. 把每个数包装成一个object **Value**
		- grad 最终loss对这个数的偏导 初始0.0
		- _prev这个数由哪些Value算出来
		- op用了什么运算
		- backward 记录梯度怎么反向传播
2. 前向 建图 d=a*b+c    每做一步运算新生成一个Value
3. back propagation      调用  d.backward() 先令 $\frac{\partial d}{\partial d}=1$ 再从 `d` 沿着图往回 依次调用每个节点的 `_backward`，用**链式法则**将梯度一层层传回去 (?)
## Step-1: Wrap Numbers in  an Object
```python
class Value:
	def __init__(self,data,_children=(),_op=''):
		self.data=data
		self.grad=0.0
		self._backward=lambda:None
		self._prev=set(_children)
		self._op=_op
	def __repr__(self):
		return f"Value(data={self.data}, grad={self.grad})"
```
- **__init__** is a special method that runs when you create an instance. Think of it as Python's constructor.
- **self** refers to the current object, much like Java's **this** ,and it must appear explicitly in method definition.
- **\_children=()** means if omitted, use an empty tuple
- **1-element tuple (a==🔴,==)** notice that the **comma** matters
- ==🔴**lambda:None** stores a **function** .== 
		for example: f = lambda x: x*2
				  f(4)
				    returns:8
	 ==🔵syntax: lambda parameters: expression== 
- set() creates a set
		for instance:
		 set(\[1, 1, 2])-->{1, 2}
- v.data ==🟠当前数值v==
- v.grad ==🟠反向传播后 最终输出对v的导数 $$
\frac{\partial L}{\partial v}
$$==

- v.prev ==🟠哪些输入节点直接算出了v==
- v._backward ==🟠如何把v收到的梯度传回这些输入== 

```python
a=Value(2.0)
print(a)
#result:Value(data=2.0,grad=0.0)
```

## Step-2: Make Arithmetic Record itself
Add following inside Value class
```python
	def __add__(self,other):
		other=other if isinstance(other,Value) else Value(other)
		out=Value(self.data+other.data, (self,other), '+')
		def _backward():
			self.grad+=1.0*out.grad
			other.grad+=1.0*out.grad
		out._backward=_backward
		return out
	
	def __mul__(self,other):
		other=other if isinstance(other,Value)else Value(other)
		out=Value(self.data*other.data, (self,other),'*')
		def _backward():
			self.grad+=other.data*out.grad
			other.grad+=self.data*out.grad
		out._backward=_backward
		return out
	
```
