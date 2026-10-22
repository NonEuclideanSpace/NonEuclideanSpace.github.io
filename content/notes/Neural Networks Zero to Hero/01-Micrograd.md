**Micrograd** is an **automatic differentiation engine** that operates on single numbers rather than tensors, which makes it slow and completely transparent. 
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

```python
a=Value(2.0)
print(a)
#result:Value(data=2.0,grad=0.0)
```

## Step-2: Make Arithmetic Record itself
Add following inside Value class
```python
	def __add__(self,other):
		other=other if isinstacnce(other,Value) else Value(other)
		out=Value(self.data+other.data, (self,other), '+')
		def _backward():
			self.grad+=1.0*out.grad
			other.grad+=1.0*out.grad
		out._backward=_backward
		return out
	
```